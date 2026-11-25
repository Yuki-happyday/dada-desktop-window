import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// line-awesome 的 @font-face 带 eot/woff2/woff/ttf/svg 五种格式，CSS url() 不吃
// assetsInlineLimit 函数，兜底格式会被全部内联（styles.css 暴涨）。这里在转换期直接把
// 每个 @font-face 改写为仅保留 woff2（Obsidian 桌面端 Chromium 必够用），字体以
// data-uri 内联进 styles.css。
function laWoff2Only() {
  return {
    name: 'dada:la-woff2-only',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('line-awesome.min.css')) return null;
      const next = code.replace(
        /src:url\(([^)]*)\.eot\);src:url\([^)]*\) format\("embedded-opentype"\),url\(([^)]*)\.woff2\) format\("woff2"\),url\([^)]*\) format\("woff"\),url\([^)]*\) format\("truetype"\),url\([^)]*\) format\("svg"\)/g,
        'src:url($1.woff2) format("woff2")'
      );
      return { code: next, map: null };
    }
  };
}


// ============================================================================
// Dada 桌面日程 · Obsidian 独立扩展构建（库模式）
// ----------------------------------------------------------------------------
// 产物写入 dada-desktop-window/：轻量入口 main.js/styles.css，
// 按需界面 ui.cjs/ui.css，以及 manifest.json 和许可证。
// external：obsidian / electron 由 Obsidian 宿主提供，不打包。
//
// 手动部署：复制完整产物目录到独立测试仓库的 .obsidian/plugins/。
// ============================================================================

const root = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = 'dada-desktop-window';
const isDev = process.env.DADA_DEV === '1';
const uiBuild=process.argv.includes('ui');

function isolateUiCss(){
 return {postcssPlugin:'dada-desktop-isolation',Once(root){
  const animations=new Map();
  root.walkAtRules(/keyframes$/,rule=>{const name=rule.params;const renamed='dada-desktop-'+name;animations.set(name,renamed);rule.params=renamed;});
  root.walkDecls(decl=>{
   decl.value=decl.value.replaceAll('Line Awesome Free','Dada Desktop LA Free').replaceAll('Line Awesome Brands','Dada Desktop LA Brands');
   if(/animation/.test(decl.prop))for(const [from,to] of animations)decl.value=decl.value.replace(new RegExp('\\b'+from+'\\b','g'),to);
  });
  root.walkRules(rule=>{
   if(rule.parent.type==='atrule'&&/keyframes$/.test(rule.parent.name))return;
   rule.selectors=rule.selectors.map(selector=>{
    const theme=selector.match(/^(\.theme-(?:dark|light))\s+/);
    if(theme)return theme[1]+' :where(.dada-desktop-ui) '+selector.slice(theme[0].length);
    return ':where(.dada-desktop-ui) '+selector;
   });
  });
 }};
}

/** 构建产物附带扩展清单与保留的许可证。 */
function copyManifest() {
  return {
    name: 'dada:copy-manifest',
    writeBundle() {
      for(const name of ['manifest.json','LICENSE','THIRD-PARTY-NOTICES.txt','THIRD-PARTY-LICENSES.txt'])
        copyFileSync(resolve(root,name),resolve(root,OUT_DIR,name));
    }
  };
}

export default defineConfig({
  plugins: [laWoff2Only(), vue(), copyManifest()],
  css:uiBuild?{postcss:{plugins:[isolateUiCss()]}}:undefined,
  // 编译期注入 dev 标志 + 兜底手机端无 process 全局
  define: {
    __DADA_DEV__: JSON.stringify(isDev),
    'process.env': JSON.stringify({ NODE_ENV: isDev ? 'development' : 'production' })
  },
  build: {
    outDir: OUT_DIR,
    // 任何模式都不清空产物目录：产物可能被测试库软链为插件目录，
    // Obsidian 把运行时配置 data.json 写在这里，清空会删掉用户的标签颜色等全部设置
    // 构建与安装时必须保留已有 data.json。
    emptyOutDir: false,
    lib: {
      entry: uiBuild?'src/desktop/ui.js':'src/desktop/main.js',
      formats: ['cjs'],
      fileName: () => uiBuild?'ui.cjs':'main.js'
    },
    rollupOptions: {
      external: ['obsidian', 'electron', '@electron/remote', 'node:timers', 'node:timers/promises', 'node:fs', 'node:path'],
      output: {
        // 手机端 webview 无 process 全局时的兜底（仅不存在时注入）
        banner: `try{if(typeof process==='undefined'){globalThis.process={env:{NODE_ENV:${JSON.stringify(isDev ? 'development' : 'production')}}};}}catch(e){}`,
        // Obsidian 约定样式文件名为 styles.css
        assetFileNames: (info) => (info.name && info.name.endsWith('.css') ? (uiBuild?'ui.css':'styles.css') : '[name].[ext]')
      }
    },
    cssCodeSplit: false,
    // Obsidian 桌面端为 Electron（Chromium 较新），无需转译降级
    target: 'chrome108',
    // line-awesome 字体：woff2 以 data-uri 内联进 UI 样式，
    // 避免安装时丢失外部字体；woff/ttf/eot/svg 是 Chromium 用不到的兜底格式，
    // 一律不内联（emit 到 dist/assets 也不会被引用）
    assetsInlineLimit: (filePath) => filePath.endsWith('.woff2')
  }
});
