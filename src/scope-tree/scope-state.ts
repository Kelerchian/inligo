import { Container } from "unstated";

export class ScopeState<State extends object> extends Container<State> {
  constructor(state: State) {
    super();
    this.state = state;
  }
}
