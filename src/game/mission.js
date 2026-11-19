/**
 * Mission orchestration: campus movement, station entry, the 180-second clock,
 * answer recording and the final report.
 */
import { CampusRenderer } from '../world/renderer.js';
import {
  STATIONS, STATION_BY_ID, NPCS, MISSION_ROUTE, SPAWN, canStand, nearestInteractable, planKeyFor,
} from '../world/campus.js';
import { AVATARS } from '../world/sprites.js';
import { npcs as NPC_DATA } from '../content/dialogues.js';
import { buildMissionPlan, getExercises } from '../content/index.js';
import { SKILL_INFO } from '../content/schema.js';
import { MissionTimer } from '../core/timer.js';
import { sample } from '../core/util.js';
import {
  newSession, recordAnswer, recordParticipation, completeStation, visitStation,
  computeResults,
} from '../core/scoring.js';
import { evaluateAchievements, achievementProgress } from '../core/achievements.js';

const SPEED = 3.4; // tiles per second
const TIME_CREDIT = 3; // seconds granted per correct answer (capped in the timer)

const STATION_KICKER = {
  vocabulary: 'Vocabulary Garden · word practice',
  grammar: 'Grammar Classroom · accuracy',
  listening: 'Listening Lounge · audio',
  speaking: 'Speaking Stage · production',
  reading: 'Reading Library · bonus',
  writing: 'Writing Office · bonus',
  culture: 'American Culture Zone · discovery',
  arena: 'Final Challenge Arena · last two questions',
};

export class Mission {
  constructor({ ui, store, audio, activities, dialogue, callbacks = {} }) {
    this.ui = ui;
    this.store = store;
    this.audio = audio;
    this.activities = activities;
    this.dialogue = dialogue;
    this.callbacks = callbacks;
    this.renderer = new CampusRenderer(ui.el.gameCanvas);
    this.state = 'idle';
    this.session = null;
    this.plan = null;
    this.level = store.get().level || 'A1';
    this.player = { x: SPAWN.x, y: SPAWN.y, dir: 'down', frame: 0, moving: false, walk: 0, palette: AVATARS[0] };
    this.nearest = null;
    this.activeStation = null;
    this.stationScores = {};
    this.raf = null;
    this.lastTime = 0;
    this.tickAccumulator = 0;
    this.bindRenderer();
  }

  bindRenderer() {
    this.renderer.setNpcs(NPCS.map((npc) => ({
      ...npc,
      name: NPC_DATA[npc.id]?.name || npc.id,
      palette: NPC_DATA[npc.id]?.palette || AVATARS[0],
    })));
  }

  get isPlaying() { return this.state === 'playing'; }

  start(level = this.level) {
    this.stopLoop();
    this.closeActivitySilently();
    this.ui.closeAllOverlays();
    this.level = level;
    this.store.setLevel(level);
    this.plan = buildMissionPlan(level);
    this.readingItems = sample(getExercises('reading', level), 1);
    this.session = newSession(level);
    this.stationScores = {};
    this.activeStation = null;
    this.nearest = null;
    this.state = 'playing';
    this.player = {
      x: SPAWN.x, y: SPAWN.y, dir: 'down', frame: 0, moving: false, walk: 0,
      palette: AVATARS[this.store.get().avatar % AVATARS.length] || AVATARS[0],
    };
    this.renderer.setPlayer(this.player);
    this.renderer.camPx = null;
    this.renderer.nextStation = MISSION_ROUTE[0];
    this.renderer.highlight = null;
    this.timer = new MissionTimer(180).start();
    this.ui.showScreen('game');
    this.ui.updateProfile();
    this.ui.setInteraction(null);
    this.ui.setLocation('English Club Hub');
    this.refreshRoute();
    this.ui.updateHUD({
      remaining: this.timer.remainingSeconds(),
      ratio: this.timer.ratio(),
      score: 0,
      phase: `Next: ${STATION_BY_ID[MISSION_ROUTE[0]].name}`,
      level,
    });
    this.audio.applySettings(this.store.getSettings());
    this.audio.startMusic();
    this.audio.play('fanfare');
    this.ui.toast('Mission started. Follow the glowing pads — talk to Miss Rivera first.', { ms: 3600 });
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  loop(now) {
    const dt = Math.min(0.05, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;

    if (this.state === 'playing') {
      if (!this.ui.anyOverlayOpen()) this.movePlayer(dt);
      this.ui.updateHUD({
        remaining: this.timer.remainingSeconds(),
        ratio: this.timer.ratio(),
        score: this.session?.score || 0,
        phase: this.phaseLabel(),
        level: this.level,
      });
      if (this.timer.isExpired()) {
        this.end('time');
        return;
      }
      this.detectNearby();
    }

    this.renderer.update(dt);
    this.renderer.render();
    if (this.state !== 'ended') this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  stopLoop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  movePlayer(dt) {
    const dir = this.inputAxis ? this.inputAxis() : { x: 0, y: 0, active: false };
    if (!dir.active) {
      this.player.moving = false;
      this.player.frame = 0;
      this.renderer.setPlayer(this.player);
      return;
    }
    const nx = this.player.x + dir.x * SPEED * dt;
    const ny = this.player.y + dir.y * SPEED * dt;
    if (canStand(nx, this.player.y)) this.player.x = nx;
    if (canStand(this.player.x, ny)) this.player.y = ny;
    this.player.moving = true;
    this.player.walk += dt * 8;
    this.player.frame = Math.floor(this.player.walk) % 4;
    const sx = dir.x - dir.y;
    const sy = dir.x + dir.y;
    this.player.dir = Math.abs(sx) > Math.abs(sy) ? (sx > 0 ? 'right' : 'left') : (sy > 0 ? 'down' : 'up');
    this.renderer.setPlayer(this.player);
  }

  detectNearby() {
    const nearest = nearestInteractable(this.player);
    const key = nearest ? `${nearest.kind}:${nearest.id}` : null;
    const previousKey = this.nearest ? `${this.nearest.kind}:${this.nearest.id}` : null;
    if (key === previousKey) return;
    this.nearest = nearest;
    if (!nearest) {
      this.ui.setInteraction(null);
      this.renderer.highlight = null;
      this.ui.setLocation('Campus grounds');
      return;
    }
    if (nearest.kind === 'npc') {
      const npc = NPC_DATA[nearest.id];
      this.ui.setInteraction({ label: `Talk to ${npc?.name || 'club member'}` });
      this.renderer.highlight = nearest.id;
      this.ui.setLocation(npc?.role || 'Campus grounds');
    } else {
      const station = STATION_BY_ID[nearest.id];
      const done = this.session.stationsCompleted.includes(station.id);
      this.ui.setInteraction({ label: done ? `Revisit ${station.name}` : `Enter ${station.name}` });
      this.renderer.highlight = null;
      this.ui.setLocation(station.name);
    }
  }

  phaseLabel() {
    const next = MISSION_ROUTE.find((id) => !this.session.stationsCompleted.includes(id));
    if (!next) return 'Mission complete';
    return `Next: ${STATION_BY_ID[next].name}`;
  }

  interact() {
    if (this.state !== 'playing' || this.ui.anyOverlayOpen()) return;
    if (!this.nearest) {
      this.ui.toast('Stand on a glowing pad, or walk up to a club member.', { warn: true });
      return;
    }
    this.audio.play('click');
    if (this.nearest.kind === 'npc') {
      this.openDialogue(this.nearest.id);
      return;
    }
    this.openStation(this.nearest.id);
  }

  openDialogue(npcId) {
    this.dialogue.open(npcId);
  }

  onDialogueComplete({ npc }) {
    if (npc?.reward) {
      this.ui.toast(`Conversation with ${npc.name} recorded. +${npc.reward} club points.`, { ms: 2400 });
    }
  }

  openStation(id) {
    if (!this.session) return;
    const station = STATION_BY_ID[id];
    if (!station) return;
    if (id === 'hub') {
      this.openDialogue('guide');
      return;
    }
    if (id === 'achievement') {
      this.showAchievementHall();
      return;
    }
    if (this.session.stationsCompleted.includes(id) && id !== 'writing' && id !== 'reading') {
      this.ui.toast(`${station.name} is already complete. Next: ${this.phaseLabel().replace('Next: ', '')}.`, { ms: 2400 });
      return;
    }
    if (this.session.stationsCompleted.includes(id)) {
      this.ui.toast('Bonus station already completed.', { ms: 2000 });
      return;
    }
    const items = this.itemsFor(id);
    if (!items.length) {
      this.ui.toast('No exercise available at this station.', { warn: true });
      return;
    }
    this.activeStation = id;
    this.visitStation(id);
    this.audio.stopMusic();
    const skill = items[0].skill || (station.kind === 'final' ? 'grammar' : id);
    this.activities.open({
      stationId: id,
      title: station.name,
      kicker: STATION_KICKER[id] || station.description,
      icon: station.icon,
      skill,
      items,
      final: station.kind === 'final',
      finishLabel: station.kind === 'final' ? 'Finish mission' : 'Complete station',
      onAnswer: (answer) => this.onAnswer(answer),
      onFinish: (summary) => this.onStationFinished(id, summary),
      onQuitRequest: () => this.requestLeaveActivity(),
    });
  }

  itemsFor(id) {
    if (!this.plan) return [];
    if (id === 'reading') return this.readingItems || [];
    return this.plan.stations[planKeyFor(id)] || [];
  }

  visitStation(id) {
    visitStation(this.session, id);
    this.refreshRoute();
  }

  onAnswer({ item, correct, response, participation }) {
    if (!this.session || !this.activeStation) return;
    if (participation || item.type === 'speak') {
      recordParticipation(this.session, { skill: 'speaking', itemId: item.id, response });
    } else {
      recordAnswer(this.session, { skill: item.skill, itemId: item.id, correct, response });
    }
    if (correct === true) {
      this.timer.extend(TIME_CREDIT);
      if (this.timer.remainingSeconds() < 100) {
        this.ui.toast(`Accuracy credit +${TIME_CREDIT}s`, { ms: 1200 });
      }
    }
    this.ui.updateHUD({
      remaining: this.timer.remainingSeconds(),
      ratio: this.timer.ratio(),
      score: this.session.score,
      phase: this.phaseLabel(),
      level: this.level,
    });
  }

  onStationFinished(id, summary) {
    if (!this.session) return;
    this.activeStation = null;
    completeStation(this.session, id);
    this.stationScores[id] = summary;
    const station = STATION_BY_ID[id];
    this.refreshRoute();
    this.audio.play('pickup');
    this.audio.startMusic();
    if (station.kind === 'final') {
      this.end('complete');
      return;
    }
    const label = summary.percent == null ? 'completed' : `${summary.correct}/${summary.total} correct`;
    this.ui.toast(`${station.name}: ${label}. ${this.phaseLabel()}.`, { ms: 3000 });
    const next = MISSION_ROUTE.find((sid) => !this.session.stationsCompleted.includes(sid));
    this.renderer.nextStation = next || 'arena';
    this.ui.updateHUD({
      remaining: this.timer.remainingSeconds(),
      ratio: this.timer.ratio(),
      score: this.session.score,
      phase: this.phaseLabel(),
      level: this.level,
    });
  }

  requestLeaveActivity() {
    this.ui.confirm({
      title: 'Leave this station?',
      text: 'Answers you already gave are kept. The station will stay incomplete until you finish it.',
      yes: 'Leave',
      no: 'Stay',
    }, () => {
      const id = this.activeStation;
      this.closeActivitySilently();
      this.activeStation = null;
      this.audio.startMusic();
      if (id) this.ui.toast(`Left ${STATION_BY_ID[id].name}. It is still available.`, { ms: 2200 });
    });
  }

  closeActivitySilently() {
    if (this.activities.isOpen) this.activities.close();
  }

  refreshRoute() {
    const route = MISSION_ROUTE.map((id) => STATION_BY_ID[id]);
    const next = MISSION_ROUTE.find((id) => !this.session?.stationsCompleted.includes(id)) || null;
    this.ui.renderRoute(route, {
      completed: this.session?.stationsCompleted || [],
      next,
    });
    const nextStation = next || 'arena';
    this.renderer.nextStation = nextStation;
    const hint = next ? `Next: ${STATION_BY_ID[next].short}` : 'All stations complete';
    if (this.ui.el.npcHint) this.ui.el.npcHint.textContent = hint;
  }

  showAchievementHall() {
    const p = this.store.get();
    const entries = achievementProgress(p).map((a) => ({
      name: `${a.icon} ${a.name}`,
      detail: a.unlocked ? `Unlocked ${a.date}` : a.description,
      done: a.unlocked,
      score: '',
    }));
    const title = document.querySelector('#progressTitle');
    if (title) title.textContent = 'Achievement Hall';
    this.ui.renderProgress(entries);
    this.ui.openOverlay('progress');
    this.audio.play('open');
  }

  showMissionProgress() {
    const entries = STATIONS.map((station) => {
      const done = this.session?.stationsCompleted.includes(station.id);
      const score = this.stationScores[station.id];
      const detail = station.id === 'hub' || station.id === 'achievement'
        ? station.description
        : done ? 'Completed' : this.session?.stationsVisited.includes(station.id) ? 'Visited, unfinished' : 'Not visited';
      return {
        name: station.name,
        detail,
        done,
        score: score?.percent != null ? `${score.correct}/${score.total}` : '',
      };
    });
    const title = document.querySelector('#progressTitle');
    if (title) title.textContent = 'Stations & score';
    this.ui.renderProgress(entries);
    this.ui.openOverlay('progress');
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.timer.pause();
    this.inputReset?.();
    this.ui.openOverlay('pause');
    this.audio.play('open');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.ui.closeOverlay('pause');
    this.state = 'playing';
    this.timer.resume();
    this.lastTime = performance.now();
    this.audio.play('close');
  }

  restart() {
    this.ui.closeAllOverlays();
    this.start(this.level);
  }

  end(reason = 'complete') {
    if (this.state === 'ended' || !this.session) return;
    this.state = 'ended';
    this.timer.stop();
    this.session.usedSeconds = this.timer.elapsedSeconds();
    this.closeActivitySilently();
    this.dialogue.close(true);
    this.ui.closeAllOverlays();
    this.inputReset?.();
    this.stopLoop();

    const profileBefore = this.store.get();
    const result = computeResults(this.session, profileBefore.best[this.level] || 0);
    const unlocked = evaluateAchievements({ session: this.session, result, profile: profileBefore });
    this.store.recordSession(result);
    for (const def of unlocked) this.store.unlock(def);

    this.ui.renderResults(result, { unlocked, reason });
    this.ui.showScreen('results');
    this.ui.updateProfile();
    this.audio.stopMusic();
    this.audio.play(reason === 'time' ? 'wrong' : 'fanfare');
    this.callbacks.onEnd?.({ result, unlocked, reason });
  }

  /* Abandon to results from the pause menu. */
  abandon() {
    this.ui.closeAllOverlays();
    this.end('quit');
  }

  setInput(axisFn, resetFn) {
    this.inputAxis = axisFn;
    this.inputReset = resetFn;
  }

  dispose() {
    this.stopLoop();
    this.state = 'idle';
  }
}
