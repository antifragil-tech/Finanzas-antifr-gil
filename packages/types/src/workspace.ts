export type WorkspaceItem = {
  id: string;
  text: string;
};

export type WorkspaceProject = {
  id: string;
  title: string;
  subtitle: string;
  statusType: 'critical' | 'warning' | 'good' | 'neutral';
  nextStep: string;
  directorNote: string;
  items: WorkspaceItem[];
};

export type WorkspaceWeekIndex = {
  id: string;
  title: string;
  dateRange: string;
  startDate: string;
  projectsCount: number;
  alertsCount: number;
  hasAudio: boolean;
};

export type WorkspaceWeekData = {
  projects: WorkspaceProject[];
  reviewState: Record<string, 'ok' | 'question' | null>;
  comments: Record<string, string>;
};
