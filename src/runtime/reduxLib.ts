import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { IExtra } from './commonLib';

/** 常量定义 */
export const RAPPER_REQUEST = '$$RAPPER_REQUEST';
export const RAPPER_CLEAR_STORE = '$$RAPPER_CLEAR_STORE';
export const RAPPER_UPDATE_STORE = '$$RAPPER_UPDATE_STORE';
export const RAPPER_STATE_KEY = '$$rapperResponseData';

/** useAPI 的 extra */
export interface IUseAPIExtra extends Omit<IExtra, 'type'> {
  /**
   * 支持三种模式
   * paramsMatch，参数匹配模式（默认模式），判断缓存中是否有请求参数相同的数据，有就返回，没有就自动发送请求
   * notMatch，不进行参数匹配模式，判断缓存是否有接口数据，有就返回，没有就自动发送请求
   * manual，手动模式，不自动发送请求，返回数据是通过 request 请求得到的最新数据
   */
  mode?: 'paramsMatch' | 'notMatch' | 'manual';
}

/** 请求类型 */
type REQUEST_METHOD = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface IAction<T = any> {
  type: T;
}
export interface IAnyAction extends IAction {
  [extraProps: string]: any;
}
export interface IRequestAction {
  type: typeof RAPPER_REQUEST;
  payload?: {
    modelName: string;
    url: string;
    method?: REQUEST_METHOD;
    params?: any;
    types: string[];
  };
}

export type TAction = IAnyAction | IRequestAction;

/** store enhancer 参数 */
export interface IEnhancerProps {
  /** 缓存数据最大长度 */
  maxCacheLength?: number;
}

type Dispatch<A = IAnyAction> = <T extends A>(action: T, ...extraArgs: any[]) => T;
type Unsubscribe = () => void;
export type Reducer<S = any, A = IAnyAction> = (state: S | undefined, action: A) => S;
type ExtendState<IState, Extension> = [Extension] extends [never] ? IState : IState & Extension;
type Observer<T> = {
  next?(value: T): void;
};
type Observable<T> = {
  subscribe: (observer: Observer<T>) => { unsubscribe: Unsubscribe };
  [Symbol.observable](): Observable<T>;
};

export type StoreEnhancer<Ext = {}, StateExt = {}> = (
  next: StoreEnhancerStoreCreator,
) => StoreEnhancerStoreCreator<Ext, StateExt>;

export type StoreEnhancerStoreCreator<Ext = {}, StateExt = {}> = <
  S = any,
  A extends IAction = IAnyAction
>(
  reducer: Reducer<S, A>,
  preloadedState?: DeepPartial<S>,
) => IStore<S & StateExt, A> & Ext;

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

/** IStore */
export interface IStore<S = any, A = TAction, StateExt = never, Ext = {}> {
  dispatch: Dispatch<A>;
  getState(): S;
  subscribe(listener: () => void): Unsubscribe;
  replaceReducer<NewState, NewActions>(
    nextReducer: Reducer<NewState, NewActions>,
  ): IStore<ExtendState<NewState, StateExt>, NewActions, StateExt, Ext> & Ext;
  [Symbol.observable](): Observable<S>;
}

declare const $CombinedState: unique symbol;

export type CombinedState<S> = { readonly [$CombinedState]?: undefined } & S;

export type PreloadedState<S> = Required<S> extends {
  [$CombinedState]: undefined;
}
  ? S extends CombinedState<infer S1>
    ? {
        [K in keyof S1]?: S1[K] extends object ? PreloadedState<S1[K]> : S1[K];
      }
    : never
  : {
      [K in keyof S]: S[K] extends object ? PreloadedState<S[K]> : S[K];
    };

export interface IStoreCreator {
  <S, A extends IAction, Ext = {}, StateExt = never>(
    reducer: Reducer<S, A>,
    enhancer?: StoreEnhancer<Ext, StateExt>,
  ): IStore<ExtendState<S, StateExt>, A, StateExt, Ext> & Ext;
  <S, A extends IAction, Ext = {}, StateExt = never>(
    reducer: Reducer<S, A>,
    preloadedState?: PreloadedState<S>,
    enhancer?: StoreEnhancer<Ext>,
  ): IStore<ExtendState<S, StateExt>, A, StateExt, Ext> & Ext;
}

interface IFilterObj<Req> {
  request?: Req;
}
type FilterFunc<Item> = (storeData: Item) => boolean;

export interface IState {
  [key: string]: any;
}

/** 深比较 */
function looseEqual(newData: any, oldData: any): boolean {
  const newType = Object.prototype.toString.call(newData);
  const oldType = Object.prototype.toString.call(oldData);

  if (newType !== oldType) {
    return false;
  }

  if (newType === '[object Object]' || newType === '[object Array]') {
    for (const key in newData) {
      if (!looseEqual(newData[key], oldData[key])) {
        return false;
      }
    }
    for (const key in oldData) {
      if (!looseEqual(newData[key], oldData[key])) {
        return false;
      }
    }
  } else if (newData !== oldData) {
    return false;
  }

  return true;
}

/** 根据请求参数筛选，暂时只支持 request */
function paramsFilter<
  Req extends { [key: string]: any },
  I extends { request: Req },
  Fil extends { request?: Req }
>(item: I, filter: Fil): boolean {
  if (filter && filter.request) {
    const filterRequest = filter.request; // 这一行是解决 ts2532 报错
    if (Object.prototype.toString.call(filter.request) === '[object Object]') {
      const reqResult = Object.keys(filter.request).every((key): boolean => {
        return item.request[key] === filterRequest[key];
      });
      if (!reqResult) {
        return false;
      }
    } else {
      return false;
    }
  }
  return true;
}

function getFilteredData<Req, Item extends { request: Req }>(
  reduxData: any[],
  filter?: IFilterObj<Req> | FilterFunc<Item>,
) {
  let resultArr = [];
  if (filter) {
    if (typeof filter === 'function') {
      resultArr = reduxData.filter((item: Item) => filter(item));
    } else {
      resultArr = reduxData.filter((item: Item) =>
        paramsFilter<Req, Item, typeof filter>(item, filter),
      );
    }
  } else {
    resultArr = reduxData;
  }
  return resultArr.length ? resultArr.slice(-1)[0] : {};
}

/** 以Hooks方式获取response数据 */
export function useResponseData<M, Req, Res, Item extends { request: Req }>(
  modelName: M,
  filter?: IFilterObj<Req> | FilterFunc<Item>,
) {
  const reduxData = useSelector((state: IState) => {
    return (state.$$rapperResponseData && state.$$rapperResponseData[modelName]) || [];
  });
  const initData = getFilteredData<Req, Item>(reduxData, filter);
  const [id, setId] = useState(initData.id || undefined);
  const [filteredData, setFilteredData] = useState(initData.response || undefined);
  const [isPending, setIsPending] = useState(initData.isPending || false);
  const [errorMessage, setErrorMessage] = useState(initData.errorMessage || undefined);

  useEffect(() => {
    /** 过滤出一条最新的符合条件的数据 */
    const result = getFilteredData<Req, Item>(reduxData, filter);

    !looseEqual(result.response, filteredData) && setFilteredData(result.response || undefined);
    setId(result.id);
    setIsPending(result.isPending || false);
    setErrorMessage(result.errorMessage);
  }, [reduxData, filter, filteredData]);

  return [filteredData, { id, isPending, errorMessage }] as [
    Res | undefined,
    {
      /** 本次请求的唯一id */
      id: number;
      /** 是否正在请求中 */
      isPending: boolean;
      /** 请求错误信息 */
      errorMessage?: string;
    },
  ];
}

/** class component获取response数据 */
export function getResponseData<M, Req, Res, Item extends { request: Req }>(
  state: IState,
  modelName: M,
  filter?: IFilterObj<Req> | FilterFunc<Item>,
) {
  const reduxData = (state.$$rapperResponseData && state.$$rapperResponseData[modelName]) || [];
  const result = getFilteredData<Req, Item>(reduxData, filter);
  return [
    result.response || undefined,
    { id: result.id, isPending: result.isPending || false, errorMessage: result.errorMessage },
  ] as [Res | undefined, { id: number; isPending: boolean; errorMessage?: string }];
}

/** class component获取response数据 */
export function getRapperDataSelector<M, Res>(state: IState, modelName: M) {
  const reduxData = (state.$$rapperResponseData && state.$$rapperResponseData[modelName]) || [];
  const result = reduxData.length ? reduxData.slice(-1)[0] : {};
  return result.response as Res | undefined;
}

interface IRapperCommonParams<M, Req, Item, IFetcher> {
  modelName: M;
  fetcher: IFetcher;
  requestParams?: Req;
  extra?: IUseAPIExtra;
  filter?: IFilterObj<Req> | FilterFunc<Item>;
}
/** useAPI */
export function useAPICommon<
  M,
  Req,
  Res,
  IFetcher extends (requestParams?: Req, extra?: IExtra) => any
>({ modelName, fetcher, requestParams, extra }: IRapperCommonParams<M, Req, {}, IFetcher>) {
  const { mode = 'paramsMatch', ...otherExtra } = extra || {};
  const reduxData = useSelector((state: IState) => {
    return (state.$$rapperResponseData && state.$$rapperResponseData[modelName]) || [];
  });
  const initData = getFilteredData<Req, { request: Req }>(
    reduxData,
    mode === 'notMatch' ? undefined : requestParams,
  );
  const [filteredData, setFilteredData] = useState(initData.response || undefined);
  const [isPending, setIsPending] = useState(initData.isPending || false);
  const [errorMessage, setErrorMessage] = useState(initData.errorMessage || undefined);

  useEffect(() => {
    /** 过滤出一条最新的符合条件的数据 */
    const result = getFilteredData<Req, { request: Req }>(
      reduxData,
      mode === 'notMatch' ? undefined : requestParams,
    );
    !looseEqual(result.response, filteredData) && setFilteredData(result.response || undefined);
    setIsPending(result.isPending || false);
    setErrorMessage(result.errorMessage);
  }, [reduxData, filteredData]);

  useEffect(() => {
    if (mode !== 'manual' && !initData.id) {
      fetcher(requestParams, otherExtra);
    }
  }, [initData.id]);

  return [filteredData, { isPending, errorMessage, request: fetcher }] as [
    Res | undefined,
    {
      /** 是否正在请求中 */
      isPending: boolean;
      /** 请求错误信息 */
      errorMessage?: string;
      /** 请求函数 */
      request: IFetcher;
    },
  ];
}

type dispatch = <Res>(action: TAction) => Promise<IAnyAction | Res>;
let dispatch: dispatch;
interface IRequestParams {
  url: string;
  /** 请求类型 */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS' | 'PATCH' | 'HEAD';
  params?: any;
  extra?: {
    [k: string]: any;
  };
}
let fetchFunc: (params: IRequestParams) => Promise<any>;

export interface IInterfaceInfo {
  /** 请求的唯一id，暂时等于requestTime */
  id: number;
  /** 请求时间 */
  requestTime: number;
  /** 是否正在 fetching */
  isPending: boolean;
  /** 错误信息 */
  errorMessage?: string;
  /** 响应时间 */
  reponseTime?: number;
}
/** redux store存的数据结构 */
interface IStateInterfaceItem extends IInterfaceInfo {
  /** 请求参数 */
  request?: any;
  /** 请求响应数据 */
  response?: any;
}
interface IAssignDataProps {
  /** 合并前的State */
  oldState: {
    [key: string]: IStateInterfaceItem[];
  };
  /** 最大缓存数 */
  maxCacheLength?: number;
  payload: {
    /** 接口的key */
    interfaceKey: string;
    id: number;
    requestTime: number;
    reponseTime?: number;
    request?: any;
    response?: any;
    isPending: boolean;
    errorMessage?: string;
  };
}
function assignData({
  oldState,
  payload: {
    interfaceKey,
    id,
    requestTime,
    reponseTime,
    request = {},
    response,
    isPending,
    errorMessage,
  },
  maxCacheLength,
}: IAssignDataProps) {
  const newState = { ...oldState };
  let data = newState[interfaceKey] || [];
  if (isPending === true) {
    /** 只存最近 maxCacheLength 个数据 */
    if (maxCacheLength !== Infinity && data.length >= maxCacheLength) {
      data = newState[interfaceKey].slice(data.length - maxCacheLength + 1);
    }
    newState[interfaceKey] = [...data, { id, requestTime, request, isPending }];
  } else {
    newState[interfaceKey] = data.map((item: IStateInterfaceItem) =>
      item.id === id ? { ...item, reponseTime, response, isPending, errorMessage } : item,
    );
  }

  return newState;
}

export const rapperReducers = {
  $$rapperResponseData: (state = {}) => state,
};

/** store enhancer */
export function rapperEnhancer(config?: IEnhancerProps): any {
  config = config || {};
  let { maxCacheLength } = config;
  if (typeof maxCacheLength !== 'number' || maxCacheLength < 1) {
    maxCacheLength = 6;
  }

  return (next: IStoreCreator) => (reducers: Reducer<any, any>, ...args: any[]) => {
    const store = next(reducers, ...args);

    /** 重新定义 reducers */
    const newReducers = (state: any, action: TAction): IStore => {
      if (state && !state.$$rapperResponseData) {
        throw Error(
          'rapper初始化配置失败，rootReducer应该加入rapperReducers，具体请查看demo配置: https://www.yuque.com/rap/rapper/react-install#rYm5X',
        );
      }

      if (!action.hasOwnProperty('type')) {
        return reducers(state, action);
      }

      switch (action.type) {
        /** 请求成功，更新 store */
        case RAPPER_UPDATE_STORE:
          return {
            ...state,
            $$rapperResponseData: assignData({
              oldState: state.$$rapperResponseData,
              maxCacheLength,
              payload: action.payload,
            }),
          };
        /** 用户手动清空 */
        case RAPPER_CLEAR_STORE:
          return {
            ...state,
            $$rapperResponseData: {
              ...state.$$rapperResponseData,
              ...action.payload,
            },
          };
        default:
          return reducers(state, action);
      }
    };
    store.replaceReducer(newReducers);

    /** 重新定义 dispatch */
    dispatch = async (action: TAction) => {
      if (action.type !== RAPPER_REQUEST) {
        return store.dispatch(action);
      }

      const {
        modelName,
        url,
        method,
        params,
        extra,
        types: [REQUEST, SUCCESS, FAILURE],
      } = action.payload;
      const state = store.getState();
      const cacheData = state?.$$rapperResponseData[modelName] || [];
      const cacheDataPending = cacheData.filter(item => item.isPending) || [];
      if (cacheDataPending.length >= maxCacheLength) {
        const errorMessage = `当前配置的缓存区最多支持${maxCacheLength}个并发请求，如需要更大的缓存区，请修改 maxCacheLength 参数`;
        store.dispatch({
          type: FAILURE,
          payload: errorMessage,
        });
        return Promise.reject(errorMessage);
      }

      const requestTime = new Date().getTime();
      store.dispatch({ type: REQUEST });
      store.dispatch({
        type: RAPPER_UPDATE_STORE,
        payload: {
          interfaceKey: modelName,
          id: requestTime,
          requestTime,
          request: params,
          isPending: true,
        },
      });
      try {
        const responseData = await fetchFunc({ url, method, params, extra });
        const reponseTime = new Date().getTime();

        store.dispatch({ type: SUCCESS, payload: responseData });
        /** 请求成功，更新store */
        store.dispatch({
          type: RAPPER_UPDATE_STORE,
          payload: {
            interfaceKey: modelName,
            id: requestTime,
            requestTime,
            reponseTime,
            request: params,
            response: responseData,
            isPending: false,
          },
        });
        return Promise.resolve(responseData);
      } catch (err) {
        const errorMessage = typeof err === 'object' ? err.message : JSON.stringify(err);
        store.dispatch({ type: FAILURE, payload: errorMessage });
        store.dispatch({
          type: RAPPER_UPDATE_STORE,
          payload: {
            interfaceKey: modelName,
            id: requestTime,
            requestTime,
            isPending: false,
            errorMessage,
          },
        });
        return Promise.reject(err);
      }
    };
    return { ...store, dispatch };
  };
}

/** 发送请求 */
export function dispatchAction<Res>(action: IAnyAction, fetch?: any) {
  fetch && (fetchFunc = fetch);
  return dispatch<Res>(action);
}
