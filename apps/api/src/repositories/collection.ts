export interface Collection<T> {
  read(): Promise<T[]>;
  write(values: T[]): Promise<void>;
  mutate<R>(operation: (values: T[]) => Promise<{ values: T[]; result: R }> | { values: T[]; result: R }): Promise<R>;
}
