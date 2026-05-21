export interface BugHunterRunConfig {
  maxDepth: number;
  maxActions: number;
  timeout: number;
  slowThreshold: number;
  output: string;
  headful: boolean;
  sameOriginOnly: boolean;
  trace: boolean;
}

export const DEFAULT_RUN_CONFIG: BugHunterRunConfig = {
  maxDepth: 2,
  maxActions: 50,
  timeout: 10000,
  slowThreshold: 3000,
  output: './reports',
  headful: false,
  sameOriginOnly: true,
  trace: true
};
