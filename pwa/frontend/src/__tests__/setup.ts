/**
 * Vitest 测试设置文件
 * 
 * 配置全局测试环境、mock 和工具
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// 在每个测试后清理 React Testing Library
afterEach(() => {
  cleanup();
});

// Mock IndexedDB
const mockIndexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
};

// Mock caches API
const mockCacheStorage = {
  open: vi.fn(),
  has: vi.fn(),
  delete: vi.fn(),
  keys: vi.fn(),
  match: vi.fn(),
};

// Mock Service Worker
const mockServiceWorker = {
  register: vi.fn(),
  getRegistration: vi.fn(),
  getRegistrations: vi.fn(),
};

// 设置全局 mocks
Object.defineProperty(global, 'indexedDB', {
  value: mockIndexedDB,
  writable: true,
});

Object.defineProperty(global, 'caches', {
  value: mockCacheStorage,
  writable: true,
});

Object.defineProperty(global.navigator, 'serviceWorker', {
  value: mockServiceWorker,
  writable: true,
});

// Mock matchMedia
Object.defineProperty(global, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock window.scrollTo
Object.defineProperty(global, 'scrollTo', {
  writable: true,
  value: vi.fn(),
});

// 导出 mocks 以便测试中使用
export { mockIndexedDB, mockCacheStorage, mockServiceWorker };
