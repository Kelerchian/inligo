import { Container } from "unstated";
import Emitter from "safe-single-emitter";
import { ScopeState } from "./scope-state";

type RecordOrEmpty<A extends string | number | symbol, B> = Record<A, B> | {};

type ScopeNodeProto<
  State extends object,
  Events extends RecordOrEmpty<string, Emitter<any>> = {},
  Actions extends RecordOrEmpty<string, Function> = {},
  SubType extends RecordOrEmpty<string, ScopeNodeProto<any, any, any, any>> = {}
> = {
  _root: ScopeNodeProto<any, any, any, any> | null;
  _nodeEvents: ScopeNodeEvents;
  _nodeEventsBridge: ScopeNodeEventsBridge;
  data: ScopeState<State>;
  events: Events;
  actions: Actions;
  sub: SubType;

  clear(): void;
  getState(): State;
  setState(change: Partial<State>): Promise<void>;
};

type ScopeNodeEvents = {
  change: Emitter<undefined>;
};

type ScopeNodeEventsBridge = {
  change: () => any;
};

type SupplyEvents<
  Events extends RecordOrEmpty<string, Emitter<any>> = {}
> = () => Events;

type SupplyActions<
  State extends object,
  Actions extends RecordOrEmpty<string, Function>
> = (getState: () => State, setState: Container<State>["setState"]) => Actions;

type SupplySubScopes<
  Scopes extends RecordOrEmpty<string, ScopeNodeProto<any, any, any, any>>
> = () => Scopes;

type Supplier<
  State extends object,
  Events extends RecordOrEmpty<string, Emitter<any>> = {},
  Actions extends RecordOrEmpty<string, Function> = {}
> = {
  events?: SupplyEvents<Events>;
  actions?: SupplyActions<State, Actions>;
};

const bindStateToScope = <State extends object>(
  state: ScopeState<State>,
  scope: ScopeNodeProto<State, any, any, any>,
) => state.subscribe(scope._nodeEventsBridge.change);

const unbindStateToScope = <State extends object>(
  state: ScopeState<State>,
  scope: ScopeNodeProto<State, any, any, any>,
) => state.unsubscribe(scope._nodeEventsBridge.change);

const bindRootRecursively = <
  State extends object,
  Events extends RecordOrEmpty<string, Emitter<any>> = {},
  Actions extends RecordOrEmpty<string, Function> = {},
  SubScopes extends RecordOrEmpty<
    string,
    ScopeNodeProto<any, any, any, any>
  > = {}
>(
  scopeNode: ScopeNodeProto<State, Events, Actions, SubScopes>,
  root: ScopeNodeProto<any, any, any, SubScopes> = scopeNode,
) => {
  scopeNode._root = root || scopeNode;
  Object.values(scopeNode.sub).forEach((subScope) =>
    bindRootRecursively(subScope, scopeNode),
  );
  return scopeNode;
};

export const createScope = <
  State extends object,
  Events extends RecordOrEmpty<string, Emitter<any>> = {},
  Actions extends RecordOrEmpty<string, Function> = {}
>(
  defaultState: State,
  creatorFunc?: Supplier<State, Events, Actions>,
) => {
  class ScopeNode<
    SubScopes extends RecordOrEmpty<string, ScopeNodeProto<any, any, any>> = {}
  > implements ScopeNodeProto<State, Events, Actions, SubScopes> {
    _root: ScopeNodeProto<any, any, any, any> | null = null;
    _nodeEvents: ScopeNodeEvents = { change: new Emitter() };
    _nodeEventsBridge: ScopeNodeEventsBridge = {
      change: () => (this._root || this)._nodeEvents.change.emit(undefined),
    };
    _initialState: State;
    data: ScopeState<State>;
    events: Events;
    actions: Actions;
    sub: SubScopes;

    constructor(param?: { state?: State; sub?: SupplySubScopes<SubScopes> }) {
      this._initialState = (param && param.state) || defaultState;
      this.data = new ScopeState(this._initialState);
      this.events =
        (creatorFunc && creatorFunc.events && creatorFunc.events()) ||
        ({} as Events);
      this.actions =
        (creatorFunc &&
          creatorFunc.actions &&
          creatorFunc.actions(
            () => this.getState(),
            (change: Partial<State>) => this.setState(change),
          )) ||
        ({} as Actions);
      this.sub = (param && param.sub && param.sub()) || ({} as SubScopes);

      bindStateToScope(this.data, this);
    }

    clear() {
      unbindStateToScope(this.data, this);
      this.data = new ScopeState(this._initialState);
      bindStateToScope(this.data, this);
    }

    getState() {
      return this.data.state;
    }

    setState(change: Partial<State>) {
      return this.data.setState(change);
    }
  }

  return {
    create: <
      SubScopes extends RecordOrEmpty<
        string,
        ScopeNodeProto<any, any, any>
      > = {}
    >(param?: {
      state?: State;
      sub?: SupplySubScopes<SubScopes>;
    }) => bindRootRecursively(new ScopeNode<SubScopes>(param)),
  };
};
