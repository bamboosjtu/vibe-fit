import { useState } from 'react';
import { Box } from '@mui/material';
import type { ExerciseType } from '../types';

interface ExerciseImageProps {
  exerciseName: string;
  type?: ExerciseType;
  size?: number;
}

// 将动作名转换为图片文件名：/ 替换为 _ 以保证文件名合法
function getImageFileName(name: string): string {
  return `${name.replace(/\//g, '_')}.png`;
}

/**
 * 动作插画组件：从 /assets/exercises/<中文动作名>.png 加载 PNG 图片。
 *
 * - 力量动作：50 个动作均有对应 PNG 图片
 * - 有氧动作：无 PNG 图片，使用品牌色占位卡片 + 首字符
 * - 加载失败：回退到占位卡片
 */
export function ExerciseImage({ exerciseName, type, size = 72 }: ExerciseImageProps) {
  const [imageError, setImageError] = useState(false);

  // 有氧动作没有 PNG 图片资源，使用占位卡片
  const usePlaceholder = type === 'cardio' || imageError;
  const imagePath = `/assets/exercises/${getImageFileName(exerciseName)}`;

  if (usePlaceholder) {
    return (
      <Box
        aria-hidden="true"
        sx={{
          width: size,
          height: size,
          display: 'grid',
          placeItems: 'center',
          borderRadius: '12px',
          bgcolor: 'rgba(16, 185, 129, 0.1)',
          color: 'primary.main',
          fontSize: size * 0.4,
          fontWeight: 900,
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
      onError={() => setImageError(true)}
      sx={{
        width: size,
        height: size,
        objectFit: 'contain',
        display: 'block',
      }}
    />
  );
}
