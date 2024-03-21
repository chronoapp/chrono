module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1"
  },
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testRegex: '(\\.|/)(test)\\.tsx?$',
};