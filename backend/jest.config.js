/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/functions', '<rootDir>/shared'],
  moduleNameMapper: {
    // Strip .js extensions from ESM-style relative imports for ts-jest
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
