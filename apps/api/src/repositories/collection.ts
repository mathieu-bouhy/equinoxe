export interface Collection<T> {
  read(): Promise<T[]>;
  write(values: T[]): Promise<void>;
}
