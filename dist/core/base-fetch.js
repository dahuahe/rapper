"use strict";
exports.__esModule = true;
exports["default"] = "\n/**\n * \u9879\u76EE\u7684\u516C\u5171\u8BF7\u6C42\u65B9\u6CD5\n * \u7528\u6237\u53EF\u5728\u6B64\u52A0\u5165\u81EA\u5B9A\u4E49\u903B\u8F91\uFF0C\u6BD4\u5982\u8BF7\u6C42\u3001\u54CD\u5E94\u6570\u636E\u8FC7\u6EE4\n * (\u5982\u6709\u9700\u8981\u53EF\u4EE5\u4FEE\u6539\uFF0C\u9879\u76EE\u521D\u59CB\u5316\u540E\u5C31\u4E0D\u4F1A\u66F4\u65B0\u6B64\u6587\u4EF6)\n */\n\n/** \u670D\u52A1\u7AEFapi\u5730\u5740\uFF0C\u9ED8\u8BA4\u662F\u6839\u76EE\u5F55\u76F8\u5BF9\u8DEF\u5F84 */\nconst requestPrefix = 'https://rap2api.alibaba-inc.com/app/mock/3402'\n\ninterface IRequestParams {\n    url: string\n    /** \u8BF7\u6C42\u7C7B\u578B */\n    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS' | 'PATCH' | 'HEAD'\n    params?: any\n}\n\nexport default async <Res>(params: IRequestParams): Promise<Res> => {\n    let requestUrl = getUrl(params.url, requestPrefix)\n    const requestParams: any = {\n        credentials: 'include',\n        method: params.method || 'GET',\n        headers: { 'Content-Type': 'application/json' },\n    }\n\n    if (requestParams.method === 'GET') {\n        requestUrl = requestUrl + '?' + locationStringify(params.params)\n    } else if (params.params) {\n        requestParams.body = JSON.stringify(params.params)\n    }\n    const res = await fetch(requestUrl, requestParams)\n    const retJSON = res.clone() // clone before return\n    return retJSON.json()\n}\n\n/**\n * search \u53C2\u6570\u8F6C\u6362\uFF0C\u6BD4\u5982 { a: 1, b: 2, c: undefined } \u8F6C\u6362\u6210 \"a=1&b=2\"\n * \u4F1A\u81EA\u52A8\u5220\u9664 undefined\n */\nfunction locationStringify(\n    obj: {\n        [key: string]: any\n    } = {}\n): string {\n    return Object.entries(obj).reduce((str, [key, value]) => {\n        if (value === undefined) {\n            return str\n        }\n        str = str ? str + '&' : str\n        return str + key + '=' + value\n    }, '')\n}\n\n/** \u62FC\u63A5\u7EC4\u5408request\u94FE\u63A5 */\nconst getUrl = (url: string, requestPrefix?: string): string => {\n  if (!requestPrefix) {\n    requestPrefix = ''\n  }\n  requestPrefix = requestPrefix.replace(/\\/$/, '')\n  url = url.replace(/^\\//, '')\n  return requestPrefix + '/' + url\n}\n";
