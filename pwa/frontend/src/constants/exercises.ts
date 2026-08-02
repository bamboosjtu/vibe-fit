import type { Exercise } from '../types';

// 动作库：按身体部位/肌群分类，与训练计划模板的 phase/group 结构对应
export const DEFAULT_EXERCISES: Exercise[] = [
  // ── 背 - 下拉 ──────────────────────────────────────────
  { id: 'pull-up', name: '引体向上', type: 'strength', muscleGroups: ['背', '肱二头'] },
  { id: 'lat-pulldown', name: '高位下拉', type: 'strength', muscleGroups: ['背', '肱二头'] },
  { id: 'machine-pulldown', name: '器械下拉', type: 'strength', muscleGroups: ['背', '肱二头'] },

  // ── 背 - 划船 ──────────────────────────────────────────
  { id: 'barbell-row', name: '杠铃俯身划船', type: 'strength', muscleGroups: ['背', '肱二头'] },
  { id: 't-bar-row', name: 'T杆俯身划船', type: 'strength', muscleGroups: ['背', '肱二头'] },
  { id: 'seated-cable-row', name: '坐姿器械划船', type: 'strength', muscleGroups: ['背', '肱二头'] },
  { id: 'dumbbell-row', name: '单边哑铃划船', type: 'strength', muscleGroups: ['背', '肱二头'] },
  { id: 'straight-arm-pulldown', name: '龙门架直臂下压', type: 'strength', muscleGroups: ['背'] },

  // ── 肩后束 ─────────────────────────────────────────────
  { id: 'rear-delt-fly', name: '哑铃俯身飞鸟', type: 'strength', muscleGroups: ['肩后束'] },
  { id: 'reverse-pec-deck', name: '蝴蝶机反向飞鸟', type: 'strength', muscleGroups: ['肩后束'] },
  { id: 'cable-rear-delt', name: '龙门架反向飞鸟', type: 'strength', muscleGroups: ['肩后束'] },
  { id: 'seated-row-rear-delt', name: '坐姿器械/绳索划船（水平开肘）', type: 'strength', muscleGroups: ['肩后束'] },

  // ── 肱二头 ─────────────────────────────────────────────
  { id: 'dumbbell-curl', name: '哑铃弯举', type: 'strength', muscleGroups: ['肱二头'] },
  { id: 'barbell-curl', name: '杠铃弯举', type: 'strength', muscleGroups: ['肱二头'] },
  { id: 'concentration-curl', name: '集中弯举', type: 'strength', muscleGroups: ['肱二头'] },
  { id: 'machine-curl', name: '器械弯举', type: 'strength', muscleGroups: ['肱二头'] },
  { id: 'preacher-curl', name: '牧师椅弯举', type: 'strength', muscleGroups: ['肱二头'] },

  // ── 胸 - 中胸 ──────────────────────────────────────────
  { id: 'bench-press', name: '杠铃/哑铃/史密斯卧推（水平推）', type: 'strength', muscleGroups: ['胸', '肱三头'] },
  { id: 'machine-chest-press', name: '器械推胸（水平推）', type: 'strength', muscleGroups: ['胸', '肱三头'] },
  { id: 'pec-deck', name: '蝴蝶机夹胸', type: 'strength', muscleGroups: ['胸'] },
  { id: 'cable-crossover', name: '龙门架夹胸（水平夹）', type: 'strength', muscleGroups: ['胸'] },

  // ── 胸 - 下胸 ──────────────────────────────────────────
  { id: 'cable-crossover-lower', name: '龙门架夹胸（完全下夹）', type: 'strength', muscleGroups: ['胸'] },
  { id: 'cable-crossover-decline', name: '龙门架夹胸（下斜夹）', type: 'strength', muscleGroups: ['胸'] },
  { id: 'decline-machine-press', name: '器械推胸（下斜推）', type: 'strength', muscleGroups: ['胸', '肱三头'] },
  { id: 'decline-press', name: '杠铃/哑铃/史密斯卧推（下斜推）', type: 'strength', muscleGroups: ['胸', '肱三头'] },
  { id: 'dips', name: '双杠臂屈伸（上身前趴30-60°）', type: 'strength', muscleGroups: ['胸', '肱三头'] },

  // ── 胸 - 上胸 ──────────────────────────────────────────
  { id: 'incline-press', name: '杠铃/哑铃/史密斯卧推（上斜推）', type: 'strength', muscleGroups: ['胸', '肱三头'] },
  { id: 'incline-machine-press', name: '器械推胸（上斜推）', type: 'strength', muscleGroups: ['胸', '肱三头'] },
  { id: 'incline-cable-crossover', name: '龙门架夹胸（上斜夹）', type: 'strength', muscleGroups: ['胸'] },

  // ── 肩前束 ─────────────────────────────────────────────
  { id: 'shoulder-press', name: '器械/哑铃/史密斯推举', type: 'strength', muscleGroups: ['肩前束', '肱三头'] },
  { id: 'front-raise', name: '杠铃/哑铃片前平举', type: 'strength', muscleGroups: ['肩前束'] },

  // ── 肩中束 ─────────────────────────────────────────────
  { id: 'lateral-raise', name: '哑铃/龙门架侧平举', type: 'strength', muscleGroups: ['肩中束'] },
  { id: 'upright-row', name: '杠铃提拉', type: 'strength', muscleGroups: ['肩中束'] },

  // ── 肱三头 ─────────────────────────────────────────────
  { id: 'tricep-pushdown-bar', name: '龙门架直杆下压', type: 'strength', muscleGroups: ['肱三头'] },
  { id: 'tricep-pushdown-rope', name: '龙门架绳索臂屈伸', type: 'strength', muscleGroups: ['肱三头'] },
  { id: 'overhead-tricep', name: '哑铃颈后臂屈伸', type: 'strength', muscleGroups: ['肱三头'] },
  { id: 'skull-crusher', name: '杠铃仰卧臂屈伸', type: 'strength', muscleGroups: ['肱三头'] },
  { id: 'close-grip-bench', name: '杠铃/哑铃/史密斯窄距卧推', type: 'strength', muscleGroups: ['肱三头', '胸'] },

  // ── 腿臀 - 股四头肌 ────────────────────────────────────
  { id: 'squat', name: '杠铃深蹲', type: 'strength', muscleGroups: ['股四头肌', '臀大肌'] },
  { id: 'leg-extension', name: '器械腿屈伸', type: 'strength', muscleGroups: ['股四头肌'] },

  // ── 腿臀 - 腘绳肌 ──────────────────────────────────────
  { id: 'romanian-deadlift', name: '罗马尼亚/传统硬拉', type: 'strength', muscleGroups: ['腘绳肌', '臀大肌'] },
  { id: 'leg-curl', name: '器械腿弯举', type: 'strength', muscleGroups: ['腘绳肌'] },

  // ── 腿臀 - 臀大肌 ──────────────────────────────────────
  { id: 'machine-hip-thrust', name: '器械臀冲', type: 'strength', muscleGroups: ['臀大肌'] },
  { id: 'barbell-hip-thrust', name: '杠铃臀冲', type: 'strength', muscleGroups: ['臀大肌'] },

  // ── 腿臀 - 兼练动作 ────────────────────────────────────
  { id: 'hack-squat', name: '哈克机', type: 'strength', muscleGroups: ['股四头肌', '臀大肌'] },
  { id: 'leg-press', name: '倒蹬机', type: 'strength', muscleGroups: ['股四头肌', '臀大肌'] },
  { id: 'lunges', name: '箭步蹲', type: 'strength', muscleGroups: ['股四头肌', '臀大肌'] },
  { id: 'smith-squat', name: '史密斯深蹲', type: 'strength', muscleGroups: ['股四头肌', '臀大肌'] },

  // ── 腹 ─────────────────────────────────────────────────
  { id: 'crunch', name: '平板卷腹', type: 'strength', muscleGroups: ['腹'] },
  { id: 'hanging-leg-raise', name: '悬垂举腿', type: 'strength', muscleGroups: ['腹'] },

  // ── 有氧 ───────────────────────────────────────────────
  { id: 'treadmill', name: '跑步机', type: 'cardio', muscleGroups: ['心肺'] },
  { id: 'elliptical', name: '椭圆机', type: 'cardio', muscleGroups: ['心肺'] },
  { id: 'rowing-machine', name: '划船机', type: 'cardio', muscleGroups: ['心肺', '背'] },
];
