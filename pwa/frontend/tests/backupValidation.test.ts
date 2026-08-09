import { describe, expect, it } from 'vitest';
import { parseExportData } from '../src/utils/helpers';

describe('parseExportData', () => {
  it('导入老备份时应用 schema 默认值', () => {
    const parsed = parseExportData({
      schemaVersion: 1,
      exportedAt: '2026-08-08T08:00:00.000Z',
      appVersion: '1.0.0',
      settings: {},
      plans: [],
      sessions: [],
      exercises: [],
    });

    expect(parsed?.settings).toEqual({
      weightUnit: 'kg',
      distanceUnit: 'km',
      darkMode: false,
      schemaVersion: 1,
    });
  });

  it('数组字段类型错误时拒绝导入', () => {
    expect(parseExportData({
      schemaVersion: 1,
      exportedAt: '2026-08-08T08:00:00.000Z',
      appVersion: '1.0.4',
      settings: {},
      plans: 'invalid',
      sessions: [],
      exercises: [],
    })).toBeNull();
  });
});
