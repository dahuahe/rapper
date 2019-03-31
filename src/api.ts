import convert from './convert';
import axios from 'axios';
import * as _ from 'lodash';
import * as path from 'path';
import * as fs from 'fs';
import * as mkdirp from 'mkdirp';
import { format } from 'json-schema-to-typescript/dist/src/formatter';
import { DEFAULT_OPTIONS } from 'json-schema-to-typescript';
import { Interface } from './itf';

function formatCode(code: string) {
  return format(code, DEFAULT_OPTIONS);
}

function urlToName(url: string, namePrefix: string = ''): string {
  url = url.trim();
  return namePrefix + path.basename(url, path.extname(url));
}

function withoutExt(p: string) {
  return p.replace(/\.[^/.]+$/, '');
}

function relativeImport(from: string, to: string) {
  return withoutExt('./' + path.relative(path.dirname(from), to));
}

function urlToPath(folder: string, url: string, suffix: string = ''): string {
  const relativePath = url.trim().replace(/^\/+/g, '');
  const newFileName = path.join(
    path.dirname(relativePath),
    `${urlToName(relativePath)}${suffix}.ts`
  );
  return path.resolve(folder, newFileName);
}

function itfToModelName(itf: Interface.Root, urlMapper: UrlMapper) {
  const url = urlMapper(itf.url.trim());
  return [...url.split('/'), itf.method.toLowerCase()].join('_');
}

function writeFile(filepath: string, contents: string) {
  return new Promise((resolve, reject) => {
    mkdirp(path.dirname(filepath), function(err) {
      if (err) return reject(`filepath: ${filepath}, ${err}`);
      fs.writeFile(filepath, contents, err => {
        if (err) return reject(`filepath: ${filepath}, ${err}`);
        resolve();
      });
    });
  });
}

async function getInterfaces(projectId: number) {
  return axios
    .get(`http://rap2api.alibaba-inc.com/repository/get?id=${projectId}`)
    .then(response => {
      const modules: Array<any> = response.data.data.modules;
      const interfaces: Array<Interface.Root> = _(modules)
        .map(m => m.interfaces)
        .flatten()
        .value();
      return interfaces;
    });
}

interface RequestFactory {
  (itf: Interface.Root, ReqType: string, ResType: string): string;
}

interface UrlMapper {
  (url: string): string;
}

interface CreateApiParams {
  projectId: number;
  folder: string;
  requestFactory: RequestFactory;
  urlMapper?: UrlMapper;
}

export async function createApi({
  projectId,
  folder,
  requestFactory,
  urlMapper = s => s
}: CreateApiParams) {
  return getInterfaces(projectId).then(interfaces => {
    return Promise.all(
      interfaces.map(async itf => {
        const url = urlMapper(itf.url);
        const writeItf = ([reqItf, resItf]: [string, string]) => {
          const itfFileName = urlToPath(folder, url, '-itf');
          return Promise.all([
            writeFile(
              itfFileName,
              formatCode(
                `/**
              * 本文件由 Rapper 从 Rap 中自动生成，请勿修改
              * 接口名：${itf.name}
              * Rap: http://rap2.alibaba-inc.com/repository/editor?id=${projectId}&mod=${
                  itf.moduleId
                }&itf=${itf.id}
              */
            ${reqItf}
  
            ${resItf}`
              )
            ),
            writeFile(
              urlToPath(folder, url),
              formatCode(
                `/**
              * 本文件由 Rapper 从 Rap 中自动生成，请勿修改
              * 接口名：${itf.name}
              * Rap: http://rap2.alibaba-inc.com/repository/editor?id=${projectId}&mod=${
                  itf.moduleId
                }&itf=${itf.id}
              */
              import { Req, Res } from './${path.basename(
                itfFileName,
                path.extname(itfFileName)
              )}';
              /* 自定义请求代码开始 */
              ${requestFactory(itf, 'Req', 'Res')}
              /* 自定义请求代码结束 */
              `
              )
            )
          ]);
        };
        return convert(itf)
          .then(writeItf)
          .catch(err => `${url}+${err}`);
      })
    );
  });
}

export async function createModel({
  projectId,
  modelPath,
  requesterPath: fetcherPath,
  baseFetchPath,
  urlMapper = t => t
}: {
  projectId: number;
  modelPath: string;
  requesterPath?: string;
  baseFetchPath?: string;
  urlMapper?: UrlMapper;
}) {
  const interfaces = await getInterfaces(projectId);
  const itfStrs = await Promise.all(
    interfaces.map(itf => {
      return convert(itf).then(([reqItf, resItf]) => {
        return `
        /**
         * 接口名：${itf.name}
         * Rap 地址: http://rap2.alibaba-inc.com/repository/editor?id=${projectId}&mod=${
          itf.moduleId
        }&itf=${itf.id}
         */
        export namespace ${itfToModelName(itf, urlMapper)} {
          ${reqItf}

          ${resItf}
        }
      `;
      });
    })
  );
  const modelItf = formatCode(`
    /**
     * 本文件由 Rapper 从 Rap 中自动生成，请勿修改
     * Rap 地址: http://rap2.alibaba-inc.com/repository/editor?id=${projectId}
     */
    export namespace ModelItf {
      ${itfStrs.join('\n\n')}
    };
  `);
  if (fetcherPath) {
    const relModelPath = relativeImport(fetcherPath, modelPath);
    const relBaseFetchPath = relativeImport(fetcherPath, baseFetchPath);

    const fetcher = formatCode(`
    /**
     * 本文件由 Rapper 从 Rap 中自动生成，请勿修改
     * Rap 地址: http://rap2.alibaba-inc.com/repository/editor?id=${projectId}
     */
    import fetch from '${relBaseFetchPath}';
    import { ModelItf } from '${relModelPath}';
    const request = {
      ${interfaces
        .map(itf => {
          const modelName = itfToModelName(itf, urlMapper);
          return `
        '${modelName}': (req: ModelItf.${modelName}.Req | object = {}): Promise<ModelItf.${modelName}.Res> => {
          return fetch('${itf.url}', req) as Promise<ModelItf.${modelName}.Res>;
        }`;
        })
        .join(',\n\n')}
    };
    export default request;
  `);
    return Promise.all([
      writeFile(modelPath, modelItf),
      writeFile(fetcherPath, fetcher)
    ]);
  } else {
    return writeFile(modelPath, modelItf);
  }
}