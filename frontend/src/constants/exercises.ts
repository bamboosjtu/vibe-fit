import type { Exercise } from '../types';

export const DEFAULT_EXERCISES: Exercise[] = [
  // 胸部
  { id: 'bench-press', name: '杠铃卧推', type: 'strength', muscleGroups: ['胸部', '肱三头'] },
  { id: 'incline-bench-press', name: '上斜杠铃卧推', type: 'strength', muscleGroups: ['胸部', '肱三头'] },
  { id: 'dumbbell-fly', name: '哑铃飞鸟', type: 'strength', muscleGroups: ['胸部'] },
  { id: 'incline-dumbbell-press', name: '上斜哑铃卧推', type: 'strength', muscleGroups: ['胸部', '肱三头'] },
  { id: 'cable-crossover', name: '绳索夹胸', type: 'strength', muscleGroups: ['胸部'] },
  { id: 'chest-press-machine', name: '器械推胸', type: 'strength', muscleGroups: ['胸部', '肱三头'] },
  { id: 'push-up', name: '俯卧撑', type: 'strength', muscleGroups: ['胸部', '肱三头'] },
  
  // 背部
  { id: 'deadlift', name: '硬拉', type: 'strength', muscleGroups: ['背部', '腿臀'] },
  { id: 'pull-up', name: '引体向上', type: 'strength', muscleGroups: ['背部', '肱二头'] },
  { id: 'lat-pulldown', name: '高位下拉', type: 'strength', muscleGroups: ['背部', '肱二头'] },
  { id: 'barbell-row', name: '杠铃划船', type: 'strength', muscleGroups: ['背部', '肱二头'] },
  { id: 'dumbbell-row', name: '哑铃划船', type: 'strength', muscleGroups: ['背部', '肱二头'] },
  { id: 'seated-cable-row', name: '坐姿划船', type: 'strength', muscleGroups: ['背部', '肱二头'] },
  { id: 't-bar-row', name: 'T杆划船', type: 'strength', muscleGroups: ['背部', '肱二头'] },
  { id: 'face-pull', name: '面拉', type: 'strength', muscleGroups: ['肩后束'] },
  { id: 'straight-arm-pulldown', name: '直臂下压', type: 'strength', muscleGroups: ['背部'] },
  
  // 肩部
  { id: 'overhead-press', name: '杠铃推举', type: 'strength', muscleGroups: ['肩前束', '肱三头'] },
  { id: 'dumbbell-shoulder-press', name: '哑铃推举', type: 'strength', muscleGroups: ['肩前束', '肱三头'] },
  { id: 'lateral-raise', name: '侧平举', type: 'strength', muscleGroups: ['肩中束'] },
  { id: 'front-raise', name: '前平举', type: 'strength', muscleGroups: ['肩前束'] },
  { id: 'rear-delt-fly', name: '俯身飞鸟', type: 'strength', muscleGroups: ['肩后束'] },
  { id: 'upright-row', name: '直立划船', type: 'strength', muscleGroups: ['肩部', '斜方肌'] },
  { id: 'arnold-press', name: '阿诺德推举', type: 'strength', muscleGroups: ['肩部', '肱三头'] },
  
  // 手臂 - 肱二头
  { id: 'barbell-curl', name: '杠铃弯举', type: 'strength', muscleGroups: ['肱二头'] },
  { id: 'dumbbell-curl', name: '哑铃弯举', type: 'strength', muscleGroups: ['肱二头'] },
  { id: 'hammer-curl', name: '锤式弯举', type: 'strength', muscleGroups: ['肱二头', '肱肌'] },
  { id: 'preacher-curl', name: '牧师凳弯举', type: 'strength', muscleGroups: ['肱二头'] },
  { id: 'incline-dumbbell-curl', name: '上斜哑铃弯举', type: 'strength', muscleGroups: ['肱二头'] },
  { id: 'cable-curl', name: '绳索弯举', type: 'strength', muscleGroups: ['肱二头'] },
  
  // 手臂 - 肱三头
  { id: 'tricep-pushdown', name: '绳索下压', type: 'strength', muscleGroups: ['肱三头'] },
  { id: 'skull-crusher', name: '碎颅者', type: 'strength', muscleGroups: ['肱三头'] },
  { id: 'overhead-tricep-extension', name: '颈后臂屈伸', type: 'strength', muscleGroups: ['肱三头'] },
  { id: 'close-grip-bench', name: '窄距卧推', type: 'strength', muscleGroups: ['肱三头', '胸部'] },
  { id: 'dumbbell-kickback', name: '哑铃臂屈伸', type: 'strength', muscleGroups: ['肱三头'] },
  { id: 'dips', name: '双杠臂屈伸', type: 'strength', muscleGroups: ['肱三头', '胸部'] },
  
  // 腿部
  { id: 'squat', name: '深蹲', type: 'strength', muscleGroups: ['腿部', '臀部'] },
  { id: 'front-squat', name: '前蹲', type: 'strength', muscleGroups: ['腿部', '臀部'] },
  { id: 'leg-press', name: '腿举', type: 'strength', muscleGroups: ['腿部', '臀部'] },
  { id: 'leg-extension', name: '腿屈伸', type: 'strength', muscleGroups: ['股四头'] },
  { id: 'leg-curl', name: '腿弯举', type: 'strength', muscleGroups: ['腘绳肌'] },
  { id: 'romanian-deadlift', name: '罗马尼亚硬拉', type: 'strength', muscleGroups: ['腘绳肌', '臀部'] },
  { id: 'lunges', name: '箭步蹲', type: 'strength', muscleGroups: ['腿部', '臀部'] },
  { id: 'bulgarian-split-squat', name: '保加利亚分腿蹲', type: 'strength', muscleGroups: ['腿部', '臀部'] },
  { id: 'calf-raise', name: '提踵', type: 'strength', muscleGroups: ['小腿'] },
  { id: 'hip-thrust', name: '臀推', type: 'strength', muscleGroups: ['臀部'] },
  
  // 核心
  { id: 'plank', name: '平板支撑', type: 'strength', muscleGroups: ['核心'] },
  { id: 'crunch', name: '卷腹', type: 'strength', muscleGroups: ['腹部'] },
  { id: 'leg-raise', name: '举腿', type: 'strength', muscleGroups: ['腹部'] },
  { id: 'russian-twist', name: '俄罗斯转体', type: 'strength', muscleGroups: ['腹部', '腹斜肌'] },
  { id: 'hanging-leg-raise', name: '悬垂举腿', type: 'strength', muscleGroups: ['腹部'] },
  { id: 'ab-wheel', name: '健腹轮', type: 'strength', muscleGroups: ['腹部'] },
  
  // 有氧
  { id: 'treadmill', name: '跑步机', type: 'cardio', muscleGroups: ['心肺'] },
  { id: 'elliptical', name: '椭圆机', type: 'cardio', muscleGroups: ['心肺'] },
  { id: 'stationary-bike', name: '动感单车', type: 'cardio', muscleGroups: ['心肺'] },
  { id: 'rowing-machine', name: '划船机', type: 'cardio', muscleGroups: ['心肺', '背部'] },
  { id: 'stair-climber', name: '爬楼机', type: 'cardio', muscleGroups: ['心肺', '腿部'] },
  { id: 'jump-rope', name: '跳绳', type: 'cardio', muscleGroups: ['心肺'] },
];

export const EXERCISE_CATEGORIES = {
  chest: '胸部',
  back: '背部',
  shoulders: '肩部',
  biceps: '肱二头',
  triceps: '肱三头',
  legs: '腿部',
  core: '核心',
  cardio: '有氧',
} as const;
