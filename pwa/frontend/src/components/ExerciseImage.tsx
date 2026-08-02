import { useState } from 'react';
import { Box } from '@mui/material';
import type { ExerciseType } from '../types';
import { getExerciseImagePath, PLACEHOLDER_BG } from '../constants/exerciseAssets';

interface ExerciseImageProps {
  /** 必填：动作 id，用于查找 manifest */
  exerciseId: string;
  /** 动作名称，仅用于占位首字符和 alt 文本 */
  exerciseName: string;
  type?: ExerciseType;
  /** 固定宽高，默认 72 */
  size?: number;
}

/**
 * 统一的动作图片组件。
 *
 * 资源来源：constants/exerciseAssets.ts 的 manifest。
 * - 力量动作：通过 exerciseId 映射到 /assets/exercises/<id>.png
 * - 有氧动作：无图片，使用品牌色占位卡片 + 首字符
 * - 加载失败：开发环境警告，回退到占位卡片
 *
 * 容器固定宽高，使用 object-fit: contain，避免拉伸。
 */
export function ExerciseImage({ exerciseId, exerciseName, type, size = 72 }: ExerciseImageProps) {
  const [imageError, setImageError] = useState(false);
  const imagePath = getExerciseImagePath(exerciseId, type);
  const usePlaceholder = !imagePath || imageError;

  if (usePlaceholder) {
    return (
      <Box
        aria-label={exerciseName}
        sx={{
          width: size,
          height: size,
          display: 'grid',
          placeItems: 'center',
          borderRadius: '12px',
          bgcolor: PLACEHOLDER_BG,
          color: 'primary.main',
          fontSize: size * 0.4,
          fontWeight: 900,
          flexShrink: 0,
        }}
      >
        {exerciseName.charAt(0)}
      </Box>
    );
  }

  return (
    <Box
      component="img"
      src={imagePath}
      alt={exerciseName}
      loading="lazy"
      onError={() => {
        if (import.meta.env?.DEV) {
          console.warn(`[ExerciseImage] 图片加载失败: ${imagePath} (exerciseId=${exerciseId})`);
        }
        setImageError(true);
      }}
      sx={{
        width: size,
        height: size,
        objectFit: 'contain',
        display: 'block',
        borderRadius: '12px',
        flexShrink: 0,
      }}
    />
  );
}
