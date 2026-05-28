import { Injectable } from '@nestjs/common';
import { Subject, type Observable } from 'rxjs';
import type { DashboardStreamEvent } from '../../domain/dashboard-stream.types';

@Injectable()
export class DashboardStreamService {
  private readonly events$ = new Subject<DashboardStreamEvent>();

  stream(): Observable<DashboardStreamEvent> {
    return this.events$.asObservable();
  }

  publish(event: DashboardStreamEvent): void {
    this.events$.next(event);
  }
}
