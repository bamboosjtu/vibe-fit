import type { TrainingPlan } from '../types';

// 三分化训练计划模板
export const THREE_DAY_SPLIT_TEMPLATE: Omit<TrainingPlan, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '健身房三分化训练计划',
  description: '最经典的增肌分化方式，兼顾恢复与频率。',
  isActive: true,
  isCurrent: false,
  currentDayIndex: 0,
  days: [
    {
      id: '3day-day1',
      name: '背 + 肩后束 + 肱二头',
      isActive: true,
      order: 0,
      phases: [
        {
          id: '3day-day1-phase1',
          name: '背',
          order: 0,
          groups: [
            {
              id: '3day-day1-phase1-group1',
              name: '下拉',
              description: '选1-2个动作 总共6-8组',
              targetTotalSets: 7,
              order: 0,
              availableExercises: [
                { exerciseId: 'pull-up', exerciseName: '引体向上', type: 'strength', targetSets: 4, targetReps: 8, order: 0 },
                { exerciseId: 'lat-pulldown', exerciseName: '高位下拉', type: 'strength', targetSets: 4, targetReps: 10, order: 1 },
                { exerciseId: 'machine-pulldown', exerciseName: '器械下拉', type: 'strength', targetSets: 4, targetReps: 10, order: 2 },
              ],
              selectedExercises: [],
            },
            {
              id: '3day-day1-phase1-group2',
              name: '划船',
              description: '选1-2个动作 总共6-8组',
              targetTotalSets: 7,
              order: 1,
              availableExercises: [
                { exerciseId: 'barbell-row', exerciseName: '杠铃俯身划船', type: 'strength', targetSets: 4, targetReps: 10, order: 0 },
                { exerciseId: 't-bar-row', exerciseName: 'T杆俯身划船', type: 'strength', targetSets: 4, targetReps: 10, order: 1 },
                { exerciseId: 'seated-cable-row', exerciseName: '坐姿器械划船', type: 'strength', targetSets: 4, targetReps: 10, order: 2 },
                { exerciseId: 'dumbbell-row', exerciseName: '单边哑铃划船', type: 'strength', targetSets: 4, targetReps: 10, order: 3 },
                { exerciseId: 'straight-arm-pulldown', exerciseName: '龙门架直臂下压', type: 'strength', targetSets: 4, targetReps: 12, order: 4 },
              ],
              selectedExercises: [],
            },
          ],
        },
        {
          id: '3day-day1-phase2',
          name: '肩后束',
          order: 1,
          groups: [
            {
              id: '3day-day1-phase2-group1',
              name: '肩后',
              description: '选1-2个动作 总共6-8组',
              targetTotalSets: 7,
              order: 0,
              availableExercises: [
                { exerciseId: 'rear-delt-fly', exerciseName: '哑铃俯身飞鸟', type: 'strength', targetSets: 4, targetReps: 15, order: 0 },
                { exerciseId: 'reverse-pec-deck', exerciseName: '蝶机反向飞鸟', type: 'strength', targetSets: 4, targetReps: 15, order: 1 },
                { exerciseId: 'cable-rear-delt', exerciseName: '龙门架反向飞鸟', type: 'strength', targetSets: 4, targetReps: 15, order: 2 },
                { exerciseId: 'seated-row-rear-delt', exerciseName: '坐姿器械/绳索划船（水平开肘）', type: 'strength', targetSets: 4, targetReps: 15, order: 3 },
              ],
              selectedExercises: [],
            },
          ],
        },
        {
          id: '3day-day1-phase3',
          name: '肱二头',
          order: 2,
          groups: [
            {
              id: '3day-day1-phase3-group1',
              name: '二头',
              description: '选1-2个动作 总共6-8组',
              targetTotalSets: 7,
              order: 0,
              availableExercises: [
                { exerciseId: 'dumbbell-curl', exerciseName: '哑铃弯举', type: 'strength', targetSets: 4, targetReps: 12, order: 0 },
                { exerciseId: 'barbell-curl', exerciseName: '杠铃弯举', type: 'strength', targetSets: 4, targetReps: 10, order: 1 },
                { exerciseId: 'concentration-curl', exerciseName: '集中弯举', type: 'strength', targetSets: 3, targetReps: 12, order: 2 },
                { exerciseId: 'machine-curl', exerciseName: '器械弯举', type: 'strength', targetSets: 4, targetReps: 12, order: 3 },
                { exerciseId: 'preacher-curl', exerciseName: '牧师椅弯举', type: 'strength', targetSets: 4, targetReps: 10, order: 4 },
              ],
              selectedExercises: [],
            },
          ],
        },
      ],
    },
    {
      id: '3day-day2',
      name: '胸 + 肩前中束 + 肱三头',
      isActive: true,
      order: 1,
      phases: [
        {
          id: '3day-day2-phase1',
          name: '胸',
          order: 0,
          groups: [
            {
              id: '3day-day2-phase1-group1',
              name: '中胸',
              description: '选2-3个动作 总共10组',
              targetTotalSets: 10,
              order: 0,
              availableExercises: [
                { exerciseId: 'bench-press', exerciseName: '杠铃/哑铃/史密斯卧推（水平推）', type: 'strength', targetSets: 4, targetReps: 8, order: 0 },
                { exerciseId: 'machine-chest-press', exerciseName: '器械推胸（水平推）', type: 'strength', targetSets: 4, targetReps: 10, order: 1 },
                { exerciseId: 'pec-deck', exerciseName: '蝴蝶机夹胸', type: 'strength', targetSets: 3, targetReps: 12, order: 2 },
                { exerciseId: 'cable-crossover', exerciseName: '龙门架夹胸（水平夹）', type: 'strength', targetSets: 3, targetReps: 15, order: 3 },
              ],
              selectedExercises: [],
            },
            {
              id: '3day-day2-phase1-group2',
              name: '下胸',
              description: '选1个动作 总共4组',
              targetTotalSets: 4,
              order: 1,
              availableExercises: [
                { exerciseId: 'cable-crossover-lower', exerciseName: '龙门架夹胸（完全下夹）', type: 'strength', targetSets: 4, targetReps: 15, order: 0 },
                { exerciseId: 'cable-crossover-decline', exerciseName: '龙门架夹胸（下斜夹）', type: 'strength', targetSets: 4, targetReps: 15, order: 1 },
                { exerciseId: 'decline-machine-press', exerciseName: '器械推胸（下斜推）', type: 'strength', targetSets: 4, targetReps: 10, order: 2 },
                { exerciseId: 'decline-press', exerciseName: '杠铃/哑铃/史密斯卧推（下斜推）', type: 'strength', targetSets: 4, targetReps: 10, order: 3 },
                { exerciseId: 'dips', exerciseName: '双杠臂屈伸（上身前趴30-60°）', type: 'strength', targetSets: 4, targetReps: 10, order: 4 },
              ],
              selectedExercises: [],
            },
            {
              id: '3day-day2-phase1-group3',
              name: '上胸',
              description: '选1个动作 总共4组',
              targetTotalSets: 4,
              order: 2,
              availableExercises: [
                { exerciseId: 'incline-press', exerciseName: '杠铃/哑铃/史密斯卧推（上斜推）', type: 'strength', targetSets: 4, targetReps: 10, order: 0 },
                { exerciseId: 'incline-machine-press', exerciseName: '器械推胸（上斜推）', type: 'strength', targetSets: 4, targetReps: 10, order: 1 },
                { exerciseId: 'incline-cable-crossover', exerciseName: '龙门架夹胸（上斜夹）', type: 'strength', targetSets: 4, targetReps: 15, order: 2 },
              ],
              selectedExercises: [],
            },
          ],
        },
        {
          id: '3day-day2-phase2',
          name: '肩前束',
          order: 1,
          groups: [
            {
              id: '3day-day2-phase2-group1',
              name: '肩前',
              description: '选1个动作 总共5组',
              targetTotalSets: 5,
              order: 0,
              availableExercises: [
                { exerciseId: 'shoulder-press', exerciseName: '器械/哑铃/史密斯推举', type: 'strength', targetSets: 5, targetReps: 10, order: 0 },
                { exerciseId: 'front-raise', exerciseName: '杠铃/哑铃片前平举', type: 'strength', targetSets: 5, targetReps: 12, order: 1 },
              ],
              selectedExercises: [],
            },
          ],
        },
        {
          id: '3day-day2-phase3',
          name: '肩中束',
          order: 2,
          groups: [
            {
              id: '3day-day2-phase3-group1',
              name: '肩中',
              description: '选1个动作 总共5组',
              targetTotalSets: 5,
              order: 0,
              availableExercises: [
                { exerciseId: 'lateral-raise', exerciseName: '哑铃/龙门架侧平举', type: 'strength', targetSets: 5, targetReps: 15, order: 0 },
                { exerciseId: 'upright-row', exerciseName: '杠铃提拉', type: 'strength', targetSets: 5, targetReps: 12, order: 1 },
              ],
              selectedExercises: [],
            },
          ],
        },
        {
          id: '3day-day2-phase4',
          name: '肱三头',
          order: 3,
          groups: [
            {
              id: '3day-day2-phase4-group1',
              name: '三头',
              description: '选1个动作 总共5组',
              targetTotalSets: 5,
              order: 0,
              availableExercises: [
                { exerciseId: 'tricep-pushdown-bar', exerciseName: '龙门架直杆下压', type: 'strength', targetSets: 5, targetReps: 12, order: 0 },
                { exerciseId: 'tricep-pushdown-rope', exerciseName: '龙门架绳索臂屈伸', type: 'strength', targetSets: 5, targetReps: 12, order: 1 },
                { exerciseId: 'overhead-tricep', exerciseName: '哑铃颈后臂屈伸', type: 'strength', targetSets: 5, targetReps: 12, order: 2 },
                { exerciseId: 'skull-crusher', exerciseName: '杠铃仰卧臂屈伸', type: 'strength', targetSets: 5, targetReps: 10, order: 3 },
                { exerciseId: 'close-grip-bench', exerciseName: '杠铃/哑铃/史密斯窄距卧推', type: 'strength', targetSets: 5, targetReps: 8, order: 4 },
              ],
              selectedExercises: [],
            },
          ],
        },
      ],
    },
    {
      id: '3day-day3',
      name: '腿臀 + 腹',
      isActive: true,
      order: 2,
      phases: [
        {
          id: '3day-day3-phase1',
          name: '腿臀',
          order: 0,
          groups: [
            {
              id: '3day-day3-phase1-group1',
              name: '股四头肌',
              description: '选1-2个动作 总共6-8组',
              targetTotalSets: 7,
              order: 0,
              availableExercises: [
                { exerciseId: 'squat', exerciseName: '杠铃深蹲', type: 'strength', targetSets: 4, targetReps: 8, order: 0 },
                { exerciseId: 'leg-extension', exerciseName: '器械腿屈伸', type: 'strength', targetSets: 4, targetReps: 15, order: 1 },
              ],
              selectedExercises: [],
            },
            {
              id: '3day-day3-phase1-group2',
              name: '腘绳肌',
              description: '选1-2个动作 总共6-8组',
              targetTotalSets: 7,
              order: 1,
              availableExercises: [
                { exerciseId: 'romanian-deadlift', exerciseName: '罗马尼亚/传统硬拉', type: 'strength', targetSets: 4, targetReps: 10, order: 0 },
                { exerciseId: 'leg-curl', exerciseName: '器械腿弯举', type: 'strength', targetSets: 4, targetReps: 15, order: 1 },
              ],
              selectedExercises: [],
            },
            {
              id: '3day-day3-phase1-group3',
              name: '臀大肌',
              description: '选1-2个动作 总共6-8组',
              targetTotalSets: 7,
              order: 2,
              availableExercises: [
                { exerciseId: 'machine-hip-thrust', exerciseName: '器械臀冲', type: 'strength', targetSets: 4, targetReps: 12, order: 0 },
                { exerciseId: 'barbell-hip-thrust', exerciseName: '杠铃臀冲', type: 'strength', targetSets: 4, targetReps: 10, order: 1 },
              ],
              selectedExercises: [],
            },
            {
              id: '3day-day3-phase1-group4',
              name: '兼练动作',
              description: '选1-2个动作 总共6-8组',
              targetTotalSets: 7,
              order: 3,
              availableExercises: [
                { exerciseId: 'hack-squat', exerciseName: '哈克机', type: 'strength', targetSets: 4, targetReps: 10, order: 0 },
                { exerciseId: 'leg-press', exerciseName: '倒蹬机', type: 'strength', targetSets: 4, targetReps: 12, order: 1 },
                { exerciseId: 'lunges', exerciseName: '箭步蹲', type: 'strength', targetSets: 4, targetReps: 12, order: 2 },
                { exerciseId: 'smith-squat', exerciseName: '史密斯深蹲', type: 'strength', targetSets: 4, targetReps: 10, order: 3 },
              ],
              selectedExercises: [],
            },
          ],
        },
        {
          id: '3day-day3-phase2',
          name: '腹',
          order: 1,
          groups: [
            {
              id: '3day-day3-phase2-group1',
              name: '腹',
              description: '选1个动作 总共5组',
              targetTotalSets: 5,
              order: 0,
              availableExercises: [
                { exerciseId: 'crunch', exerciseName: '平板卷腹', type: 'strength', targetSets: 5, targetReps: 20, order: 0 },
                { exerciseId: 'hanging-leg-raise', exerciseName: '悬垂举腿', type: 'strength', targetSets: 5, targetReps: 15, order: 1 },
              ],
              selectedExercises: [],
            },
          ],
        },
      ],
    },
  ],
};

// 四分化训练计划模板（肩单练版）
export const FOUR_DAY_SPLIT_SHOULDER_TEMPLATE: Omit<TrainingPlan, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '健身房四分化（肩单练版）',
  description: '强化肩部形态，适合进入平台期的进阶者。',
  isActive: true,
  isCurrent: false,
  currentDayIndex: 0,
  days: [
    {
      id: '4day-shoulder-day1',
      name: '背 + 肱二头',
      isActive: true,
      order: 0,
      phases: [
        {
          id: '4day-shoulder-day1-phase1',
          name: '背',
          order: 0,
          groups: [
            {
              id: '4day-shoulder-day1-phase1-group1',
              name: '下拉',
              description: '选1-2个动作 总共6-8组',
              targetTotalSets: 7,
              order: 0,
              availableExercises: [
                { exerciseId: 'pull-up', exerciseName: '引体向上', type: 'strength', targetSets: 4, targetReps: 8, order: 0 },
                { exerciseId: 'lat-pulldown', exerciseName: '高位下拉', type: 'strength', targetSets: 4, targetReps: 10, order: 1 },
                { exerciseId: 'machine-pulldown', exerciseName: '器械下拉', type: 'strength', targetSets: 4, targetReps: 10, order: 2 },
              ],
              selectedExercises: [],
            },
            {
              id: '4day-shoulder-day1-phase1-group2',
              name: '划船',
              description: '选1-2个动作 总共6-8组',
              targetTotalSets: 7,
              order: 1,
              availableExercises: [
                { exerciseId: 'barbell-row', exerciseName: '杠铃俯身划船', type: 'strength', targetSets: 4, targetReps: 10, order: 0 },
                { exerciseId: 't-bar-row', exerciseName: 'T杆俯身划船', type: 'strength', targetSets: 4, targetReps: 10, order: 1 },
                { exerciseId: 'seated-cable-row', exerciseName: '坐姿器械划船', type: 'strength', targetSets: 4, targetReps: 10, order: 2 },
                { exerciseId: 'dumbbell-row', exerciseName: '单边哑铃划船', type: 'strength', targetSets: 4, targetReps: 10, order: 3 },
                { exerciseId: 'straight-arm-pulldown', exerciseName: '龙门架直臂下压', type: 'strength', targetSets: 4, targetReps: 12, order: 4 },
              ],
              selectedExercises: [],
            },
          ],
        },
        {
          id: '4day-shoulder-day1-phase2',
          name: '肱二头',
          order: 1,
          groups: [
            {
              id: '4day-shoulder-day1-phase2-group1',
              name: '二头',
              description: '选1-2个动作 总共6-8组',
              targetTotalSets: 7,
              order: 0,
              availableExercises: [
                { exerciseId: 'dumbbell-curl', exerciseName: '哑铃弯举', type: 'strength', targetSets: 4, targetReps: 12, order: 0 },
                { exerciseId: 'barbell-curl', exerciseName: '杠铃弯举', type: 'strength', targetSets: 4, targetReps: 10, order: 1 },
                { exerciseId: 'concentration-curl', exerciseName: '集中弯举', type: 'strength', targetSets: 3, targetReps: 12, order: 2 },
                { exerciseId: 'machine-curl', exerciseName: '器械弯举', type: 'strength', targetSets: 4, targetReps: 12, order: 3 },
                { exerciseId: 'preacher-curl', exerciseName: '牧师椅弯举', type: 'strength', targetSets: 4, targetReps: 10, order: 4 },
              ],
              selectedExercises: [],
            },
          ],
        },
      ],
    },
    {
      id: '4day-shoulder-day2',
      name: '胸 + 肱三头',
      isActive: true,
      order: 1,
      phases: [
        {
          id: '4day-shoulder-day2-phase1',
          name: '胸',
          order: 0,
          groups: [
            {
              id: '4day-shoulder-day2-phase1-group1',
              name: '中胸',
              description: '选2-3个动作 总共10组',
              targetTotalSets: 10,
              order: 0,
              availableExercises: [
                { exerciseId: 'bench-press', exerciseName: '杠铃/哑铃/史密斯卧推（水平推）', type: 'strength', targetSets: 4, targetReps: 8, order: 0 },
                { exerciseId: 'machine-chest-press', exerciseName: '器械推胸（水平推）', type: 'strength', targetSets: 4, targetReps: 10, order: 1 },
                { exerciseId: 'pec-deck', exerciseName: '蝴蝶机夹胸', type: 'strength', targetSets: 3, targetReps: 12, order: 2 },
                { exerciseId: 'cable-crossover', exerciseName: '龙门架夹胸（水平夹）', type: 'strength', targetSets: 3, targetReps: 15, order: 3 },
              ],
              selectedExercises: [],
            },
            {
              id: '4day-shoulder-day2-phase1-group2',
              name: '下胸',
              description: '选1个动作 总共4组',
              targetTotalSets: 4,
              order: 1,
              availableExercises: [
                { exerciseId: 'cable-crossover-lower', exerciseName: '龙门架夹胸（完全下夹）', type: 'strength', targetSets: 4, targetReps: 15, order: 0 },
                { exerciseId: 'cable-crossover-decline', exerciseName: '龙门架夹胸（下斜夹）', type: 'strength', targetSets: 4, targetReps: 15, order: 1 },
                { exerciseId: 'decline-machine-press', exerciseName: '器械推胸（下斜推）', type: 'strength', targetSets: 4, targetReps: 10, order: 2 },
                { exerciseId: 'decline-press', exerciseName: '杠铃/哑铃/史密斯卧推（下斜推）', type: 'strength', targetSets: 4, targetReps: 10, order: 3 },
                { exerciseId: 'dips', exerciseName: '双杠臂屈伸（上身前趴30-60°）', type: 'strength', targetSets: 4, targetReps: 10, order: 4 },
              ],
              selectedExercises: [],
            },
            {
              id: '4day-shoulder-day2-phase1-group3',
              name: '上胸',
              description: '选1个动作 总共4组',
              targetTotalSets: 4,
              order: 2,
              availableExercises: [
                { exerciseId: 'incline-press', exerciseName: '杠铃/哑铃/史密斯卧推（上斜推）', type: 'strength', targetSets: 4, targetReps: 10, order: 0 },
                { exerciseId: 'incline-machine-press', exerciseName: '器械推胸（上斜推）', type: 'strength', targetSets: 4, targetReps: 10, order: 1 },
                { exerciseId: 'incline-cable-crossover', exerciseName: '龙门架夹胸（上斜夹）', type: 'strength', targetSets: 4, targetReps: 15, order: 2 },
              ],
              selectedExercises: [],
            },
          ],
        },
        {
          id: '4day-shoulder-day2-phase2',
          name: '肱三头',
          order: 1,
          groups: [
            {
              id: '4day-shoulder-day2-phase2-group1',
              name: '三头',
              description: '选1个动作 总共5组',
              targetTotalSets: 5,
              order: 0,
              availableExercises: [
                { exerciseId: 'tricep-pushdown-bar', exerciseName: '龙门架直杆下压', type: 'strength', targetSets: 5, targetReps: 12, order: 0 },
                { exerciseId: 'tricep-pushdown-rope', exerciseName: '龙门架绳索臂屈伸', type: 'strength', targetSets: 5, targetReps: 12, order: 1 },
                { exerciseId: 'overhead-tricep', exerciseName: '哑铃颈后臂屈伸', type: 'strength', targetSets: 5, targetReps: 12, order: 2 },
                { exerciseId: 'skull-crusher', exerciseName: '杠铃仰卧臂屈伸', type: 'strength', targetSets: 5, targetReps: 10, order: 3 },
                { exerciseId: 'close-grip-bench', exerciseName: '杠铃/哑铃/史密斯窄距卧推', type: 'strength', targetSets: 5, targetReps: 8, order: 4 },
              ],
              selectedExercises: [],
            },
          ],
        },
      ],
    },
    {
      id: '4day-shoulder-day3',
      name: '腿臀 + 腹',
      isActive: true,
      order: 2,
      phases: [
        {
          id: '4day-shoulder-day3-phase1',
          name: '腿臀',
          order: 0,
          groups: [
            {
              id: '4day-shoulder-day3-phase1-group1',
              name: '股四头肌',
              description: '选1-2个动作 总共6-8组',
              targetTotalSets: 7,
              order: 0,
              availableExercises: [
                { exerciseId: 'squat', exerciseName: '杠铃深蹲', type: 'strength', targetSets: 4, targetReps: 8, order: 0 },
                { exerciseId: 'leg-extension', exerciseName: '器械腿屈伸', type: 'strength', targetSets: 4, targetReps: 15, order: 1 },
              ],
              selectedExercises: [],
            },
            {
              id: '4day-shoulder-day3-phase1-group2',
              name: '腘绳肌',
              description: '选1-2个动作 总共6-8组',
              targetTotalSets: 7,
              order: 1,
              availableExercises: [
                { exerciseId: 'romanian-deadlift', exerciseName: '罗马尼亚/传统硬拉', type: 'strength', targetSets: 4, targetReps: 10, order: 0 },
                { exerciseId: 'leg-curl', exerciseName: '器械腿弯举', type: 'strength', targetSets: 4, targetReps: 15, order: 1 },
              ],
              selectedExercises: [],
            },
            {
              id: '4day-shoulder-day3-phase1-group3',
              name: '臀大肌',
              description: '选1-2个动作 总共6-8组',
              targetTotalSets: 7,
              order: 2,
              availableExercises: [
                { exerciseId: 'machine-hip-thrust', exerciseName: '器械臀冲', type: 'strength', targetSets: 4, targetReps: 12, order: 0 },
                { exerciseId: 'barbell-hip-thrust', exerciseName: '杠铃臀冲', type: 'strength', targetSets: 4, targetReps: 10, order: 1 },
              ],
              selectedExercises: [],
            },
            {
              id: '4day-shoulder-day3-phase1-group4',
              name: '兼练动作',
              description: '选1-2个动作 总共6-8组',
              targetTotalSets: 7,
              order: 3,
              availableExercises: [
                { exerciseId: 'hack-squat', exerciseName: '哈克机', type: 'strength', targetSets: 4, targetReps: 10, order: 0 },
                { exerciseId: 'leg-press', exerciseName: '倒蹬机', type: 'strength', targetSets: 4, targetReps: 12, order: 1 },
                { exerciseId: 'lunges', exerciseName: '箭步蹲', type: 'strength', targetSets: 4, targetReps: 12, order: 2 },
                { exerciseId: 'smith-squat', exerciseName: '史密斯深蹲', type: 'strength', targetSets: 4, targetReps: 10, order: 3 },
              ],
              selectedExercises: [],
            },
          ],
        },
        {
          id: '4day-shoulder-day3-phase2',
          name: '腹',
          order: 1,
          groups: [
            {
              id: '4day-shoulder-day3-phase2-group1',
              name: '腹',
              description: '选1个动作 总共5组',
              targetTotalSets: 5,
              order: 0,
              availableExercises: [
                { exerciseId: 'crunch', exerciseName: '平板卷腹', type: 'strength', targetSets: 5, targetReps: 20, order: 0 },
                { exerciseId: 'hanging-leg-raise', exerciseName: '悬垂举腿', type: 'strength', targetSets: 5, targetReps: 15, order: 1 },
              ],
              selectedExercises: [],
            },
          ],
        },
      ],
    },
    {
      id: '4day-shoulder-day4',
      name: '肩',
      isActive: true,
      order: 3,
      phases: [
        {
          id: '4day-shoulder-day4-phase1',
          name: '肩前束',
          order: 0,
          groups: [
            {
              id: '4day-shoulder-day4-phase1-group1',
              name: '肩前',
              description: '选1个动作 总共5组',
              targetTotalSets: 5,
              order: 0,
              availableExercises: [
                { exerciseId: 'shoulder-press', exerciseName: '器械/哑铃/史密斯推举', type: 'strength', targetSets: 5, targetReps: 10, order: 0 },
                { exerciseId: 'front-raise', exerciseName: '杠铃/哑铃片前平举', type: 'strength', targetSets: 5, targetReps: 12, order: 1 },
              ],
              selectedExercises: [],
            },
          ],
        },
        {
          id: '4day-shoulder-day4-phase2',
          name: '肩中束',
          order: 1,
          groups: [
            {
              id: '4day-shoulder-day4-phase2-group1',
              name: '肩中',
              description: '选1个动作 总共5组',
              targetTotalSets: 5,
              order: 0,
              availableExercises: [
                { exerciseId: 'lateral-raise', exerciseName: '哑铃/龙门架侧平举', type: 'strength', targetSets: 5, targetReps: 15, order: 0 },
                { exerciseId: 'upright-row', exerciseName: '杠铃提拉', type: 'strength', targetSets: 5, targetReps: 12, order: 1 },
              ],
              selectedExercises: [],
            },
          ],
        },
        {
          id: '4day-shoulder-day4-phase3',
          name: '肩后束',
          order: 2,
          groups: [
            {
              id: '4day-shoulder-day4-phase3-group1',
              name: '肩后',
              description: '选1-2个动作 总共6-8组',
              targetTotalSets: 7,
              order: 0,
              availableExercises: [
                { exerciseId: 'rear-delt-fly', exerciseName: '哑铃俯身飞鸟', type: 'strength', targetSets: 4, targetReps: 15, order: 0 },
                { exerciseId: 'reverse-pec-deck', exerciseName: '蝶机反向飞鸟', type: 'strength', targetSets: 4, targetReps: 15, order: 1 },
                { exerciseId: 'cable-rear-delt', exerciseName: '龙门架反向飞鸟', type: 'strength', targetSets: 4, targetReps: 15, order: 2 },
                { exerciseId: 'seated-row-rear-delt', exerciseName: '坐姿器械/绳索划船（水平开肘）', type: 'strength', targetSets: 4, targetReps: 15, order: 3 },
              ],
              selectedExercises: [],
            },
          ],
        },
      ],
    },
  ],
};

// 四分化训练计划模板（手臂单练版）
export const FOUR_DAY_SPLIT_ARM_TEMPLATE: Omit<TrainingPlan, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '四分化（手臂单练版）',
  description: '独立手臂训练日，高容量轰炸二三头肌。',
  isActive: true,
  isCurrent: false,
  currentDayIndex: 0,
  days: [
    {
      id: '4day-arm-day1',
      name: '背 + 肩后束',
      isActive: true,
      order: 0,
      phases: [
        {
          id: '4day-arm-day1-phase1',
          name: '背',
          order: 0,
          groups: [
            {
              id: '4day-arm-day1-phase1-group1',
              name: '下拉',
              description: '选1-2个动作 总共6-8组',
              targetTotalSets: 7,
              order: 0,
              availableExercises: [
                { exerciseId: 'pull-up', exerciseName: '引体向上', type: 'strength', targetSets: 4, targetReps: 8, order: 0 },
                { exerciseId: 'lat-pulldown', exerciseName: '高位下拉', type: 'strength', targetSets: 4, targetReps: 10, order: 1 },
                { exerciseId: 'machine-pulldown', exerciseName: '器械下拉', type: 'strength', targetSets: 4, targetReps: 10, order: 2 },
              ],
              selectedExercises: [],
            },
            {
              id: '4day-arm-day1-phase1-group2',
              name: '划船',
              description: '选1-2个动作 总共6-8组',
              targetTotalSets: 7,
              order: 1,
              availableExercises: [
                { exerciseId: 'barbell-row', exerciseName: '杠铃俯身划船', type: 'strength', targetSets: 4, targetReps: 10, order: 0 },
                { exerciseId: 't-bar-row', exerciseName: 'T杆俯身划船', type: 'strength', targetSets: 4, targetReps: 10, order: 1 },
                { exerciseId: 'seated-cable-row', exerciseName: '坐姿器械划船', type: 'strength', targetSets: 4, targetReps: 10, order: 2 },
                { exerciseId: 'dumbbell-row', exerciseName: '单边哑铃划船', type: 'strength', targetSets: 4, targetReps: 10, order: 3 },
                { exerciseId: 'straight-arm-pulldown', exerciseName: '龙门架直臂下压', type: 'strength', targetSets: 4, targetReps: 12, order: 4 },
              ],
              selectedExercises: [],
            },
          ],
        },
        {
          id: '4day-arm-day1-phase2',
          name: '肩后束',
          order: 1,
          groups: [
            {
              id: '4day-arm-day1-phase2-group1',
              name: '肩后',
              description: '选1-2个动作 总共6-8组',
              targetTotalSets: 7,
              order: 0,
              availableExercises: [
                { exerciseId: 'rear-delt-fly', exerciseName: '哑铃俯身飞鸟', type: 'strength', targetSets: 4, targetReps: 15, order: 0 },
                { exerciseId: 'reverse-pec-deck', exerciseName: '蝶机反向飞鸟', type: 'strength', targetSets: 4, targetReps: 15, order: 1 },
                { exerciseId: 'cable-rear-delt', exerciseName: '龙门架反向飞鸟', type: 'strength', targetSets: 4, targetReps: 15, order: 2 },
                { exerciseId: 'seated-row-rear-delt', exerciseName: '坐姿器械/绳索划船（水平开肘）', type: 'strength', targetSets: 4, targetReps: 15, order: 3 },
              ],
              selectedExercises: [],
            },
          ],
        },
      ],
    },
    {
      id: '4day-arm-day2',
      name: '胸 + 肩前中束',
      isActive: true,
      order: 1,
      phases: [
        {
          id: '4day-arm-day2-phase1',
          name: '胸',
          order: 0,
          groups: [
            {
              id: '4day-arm-day2-phase1-group1',
              name: '中胸',
              description: '选2-3个动作 总共10组',
              targetTotalSets: 10,
              order: 0,
              availableExercises: [
                { exerciseId: 'bench-press', exerciseName: '杠铃/哑铃/史密斯卧推（水平推）', type: 'strength', targetSets: 4, targetReps: 8, order: 0 },
                { exerciseId: 'machine-chest-press', exerciseName: '器械推胸（水平推）', type: 'strength', targetSets: 4, targetReps: 10, order: 1 },
                { exerciseId: 'pec-deck', exerciseName: '蝴蝶机夹胸', type: 'strength', targetSets: 3, targetReps: 12, order: 2 },
                { exerciseId: 'cable-crossover', exerciseName: '龙门架夹胸（水平夹）', type: 'strength', targetSets: 3, targetReps: 15, order: 3 },
              ],
              selectedExercises: [],
            },
            {
              id: '4day-arm-day2-phase1-group2',
              name: '下胸',
              description: '选1个动作 总共4组',
              targetTotalSets: 4,
              order: 1,
              availableExercises: [
                { exerciseId: 'cable-crossover-lower', exerciseName: '龙门架夹胸（完全下夹）', type: 'strength', targetSets: 4, targetReps: 15, order: 0 },
                { exerciseId: 'cable-crossover-decline', exerciseName: '龙门架夹胸（下斜夹）', type: 'strength', targetSets: 4, targetReps: 15, order: 1 },
                { exerciseId: 'decline-machine-press', exerciseName: '器械推胸（下斜推）', type: 'strength', targetSets: 4, targetReps: 10, order: 2 },
                { exerciseId: 'decline-press', exerciseName: '杠铃/哑铃/史密斯卧推（下斜推）', type: 'strength', targetSets: 4, targetReps: 10, order: 3 },
                { exerciseId: 'dips', exerciseName: '双杠臂屈伸（上身前趴30-60°）', type: 'strength', targetSets: 4, targetReps: 10, order: 4 },
              ],
              selectedExercises: [],
            },
            {
              id: '4day-arm-day2-phase1-group3',
              name: '上胸',
              description: '选1个动作 总共4组',
              targetTotalSets: 4,
              order: 2,
              availableExercises: [
                { exerciseId: 'incline-press', exerciseName: '杠铃/哑铃/史密斯卧推（上斜推）', type: 'strength', targetSets: 4, targetReps: 10, order: 0 },
                { exerciseId: 'incline-machine-press', exerciseName: '器械推胸（上斜推）', type: 'strength', targetSets: 4, targetReps: 10, order: 1 },
                { exerciseId: 'incline-cable-crossover', exerciseName: '龙门架夹胸（上斜夹）', type: 'strength', targetSets: 4, targetReps: 15, order: 2 },
              ],
              selectedExercises: [],
            },
          ],
        },
        {
          id: '4day-arm-day2-phase2',
          name: '肩前束',
          order: 1,
          groups: [
            {
              id: '4day-arm-day2-phase2-group1',
              name: '肩前',
              description: '选1个动作 总共5组',
              targetTotalSets: 5,
              order: 0,
              availableExercises: [
                { exerciseId: 'shoulder-press', exerciseName: '器械/哑铃/史密斯推举', type: 'strength', targetSets: 5, targetReps: 10, order: 0 },
                { exerciseId: 'front-raise', exerciseName: '杠铃/哑铃片前平举', type: 'strength', targetSets: 5, targetReps: 12, order: 1 },
              ],
              selectedExercises: [],
            },
          ],
        },
        {
          id: '4day-arm-day2-phase3',
          name: '肩中束',
          order: 2,
          groups: [
            {
              id: '4day-arm-day2-phase3-group1',
              name: '肩中',
              description: '选1个动作 总共5组',
              targetTotalSets: 5,
              order: 0,
              availableExercises: [
                { exerciseId: 'lateral-raise', exerciseName: '哑铃/龙门架侧平举', type: 'strength', targetSets: 5, targetReps: 15, order: 0 },
                { exerciseId: 'upright-row', exerciseName: '杠铃提拉', type: 'strength', targetSets: 5, targetReps: 12, order: 1 },
              ],
              selectedExercises: [],
            },
          ],
        },
      ],
    },
    {
      id: '4day-arm-day3',
      name: '腿臀',
      isActive: true,
      order: 2,
      phases: [
        {
          id: '4day-arm-day3-phase1',
          name: '腿臀',
          order: 0,
          groups: [
            {
              id: '4day-arm-day3-phase1-group1',
              name: '股四头肌',
              description: '选1-2个动作 总共6-8组',
              targetTotalSets: 7,
              order: 0,
              availableExercises: [
                { exerciseId: 'squat', exerciseName: '杠铃深蹲', type: 'strength', targetSets: 4, targetReps: 8, order: 0 },
                { exerciseId: 'leg-extension', exerciseName: '器械腿屈伸', type: 'strength', targetSets: 4, targetReps: 15, order: 1 },
              ],
              selectedExercises: [],
            },
            {
              id: '4day-arm-day3-phase1-group2',
              name: '腘绳肌',
              description: '选1-2个动作 总共6-8组',
              targetTotalSets: 7,
              order: 1,
              availableExercises: [
                { exerciseId: 'romanian-deadlift', exerciseName: '罗马尼亚/传统硬拉', type: 'strength', targetSets: 4, targetReps: 10, order: 0 },
                { exerciseId: 'leg-curl', exerciseName: '器械腿弯举', type: 'strength', targetSets: 4, targetReps: 15, order: 1 },
              ],
              selectedExercises: [],
            },
            {
              id: '4day-arm-day3-phase1-group3',
              name: '臀大肌',
              description: '选1-2个动作 总共6-8组',
              targetTotalSets: 7,
              order: 2,
              availableExercises: [
                { exerciseId: 'machine-hip-thrust', exerciseName: '器械臀冲', type: 'strength', targetSets: 4, targetReps: 12, order: 0 },
                { exerciseId: 'barbell-hip-thrust', exerciseName: '杠铃臀冲', type: 'strength', targetSets: 4, targetReps: 10, order: 1 },
              ],
              selectedExercises: [],
            },
            {
              id: '4day-arm-day3-phase1-group4',
              name: '兼练动作',
              description: '选1-2个动作 总共6-8组',
              targetTotalSets: 7,
              order: 3,
              availableExercises: [
                { exerciseId: 'hack-squat', exerciseName: '哈克机', type: 'strength', targetSets: 4, targetReps: 10, order: 0 },
                { exerciseId: 'leg-press', exerciseName: '倒蹬机', type: 'strength', targetSets: 4, targetReps: 12, order: 1 },
                { exerciseId: 'lunges', exerciseName: '箭步蹲', type: 'strength', targetSets: 4, targetReps: 12, order: 2 },
                { exerciseId: 'smith-squat', exerciseName: '史密斯深蹲', type: 'strength', targetSets: 4, targetReps: 10, order: 3 },
              ],
              selectedExercises: [],
            },
          ],
        },
      ],
    },
    {
      id: '4day-arm-day4',
      name: '大臂 + 腹',
      isActive: true,
      order: 3,
      phases: [
        {
          id: '4day-arm-day4-phase1',
          name: '肱二头',
          order: 0,
          groups: [
            {
              id: '4day-arm-day4-phase1-group1',
              name: '二头',
              description: '选1-2个动作 总共6-8组',
              targetTotalSets: 7,
              order: 0,
              availableExercises: [
                { exerciseId: 'dumbbell-curl', exerciseName: '哑铃弯举', type: 'strength', targetSets: 4, targetReps: 12, order: 0 },
                { exerciseId: 'barbell-curl', exerciseName: '杠铃弯举', type: 'strength', targetSets: 4, targetReps: 10, order: 1 },
                { exerciseId: 'concentration-curl', exerciseName: '集中弯举', type: 'strength', targetSets: 3, targetReps: 12, order: 2 },
                { exerciseId: 'machine-curl', exerciseName: '器械弯举', type: 'strength', targetSets: 4, targetReps: 12, order: 3 },
                { exerciseId: 'preacher-curl', exerciseName: '牧师椅弯举', type: 'strength', targetSets: 4, targetReps: 10, order: 4 },
              ],
              selectedExercises: [],
            },
          ],
        },
        {
          id: '4day-arm-day4-phase2',
          name: '肱三头',
          order: 1,
          groups: [
            {
              id: '4day-arm-day4-phase2-group1',
              name: '三头',
              description: '选1个动作 总共5组',
              targetTotalSets: 5,
              order: 0,
              availableExercises: [
                { exerciseId: 'tricep-pushdown-bar', exerciseName: '龙门架直杆下压', type: 'strength', targetSets: 5, targetReps: 12, order: 0 },
                { exerciseId: 'tricep-pushdown-rope', exerciseName: '龙门架绳索臂屈伸', type: 'strength', targetSets: 5, targetReps: 12, order: 1 },
                { exerciseId: 'overhead-tricep', exerciseName: '哑铃颈后臂屈伸', type: 'strength', targetSets: 5, targetReps: 12, order: 2 },
                { exerciseId: 'skull-crusher', exerciseName: '杠铃仰卧臂屈伸', type: 'strength', targetSets: 5, targetReps: 10, order: 3 },
                { exerciseId: 'close-grip-bench', exerciseName: '杠铃/哑铃/史密斯窄距卧推', type: 'strength', targetSets: 5, targetReps: 8, order: 4 },
              ],
              selectedExercises: [],
            },
          ],
        },
        {
          id: '4day-arm-day4-phase3',
          name: '腹',
          order: 2,
          groups: [
            {
              id: '4day-arm-day4-phase3-group1',
              name: '腹',
              description: '选1个动作 总共5组',
              targetTotalSets: 5,
              order: 0,
              availableExercises: [
                { exerciseId: 'crunch', exerciseName: '平板卷腹', type: 'strength', targetSets: 5, targetReps: 20, order: 0 },
                { exerciseId: 'hanging-leg-raise', exerciseName: '悬垂举腿', type: 'strength', targetSets: 5, targetReps: 15, order: 1 },
              ],
              selectedExercises: [],
            },
          ],
        },
      ],
    },
  ],
};

export const TRAINING_TEMPLATES = [
  THREE_DAY_SPLIT_TEMPLATE,
  FOUR_DAY_SPLIT_SHOULDER_TEMPLATE,
  FOUR_DAY_SPLIT_ARM_TEMPLATE,
];



