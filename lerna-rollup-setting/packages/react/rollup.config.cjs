const commonjs = require("rollup-plugin-commonjs");
const resolve = require("rollup-plugin-node-resolve");
const babel = require("rollup-plugin-babel");
const pkg = require("./package.json");
const external = require("rollup-plugin-peer-deps-external");
const svgr = require("@svgr/rollup");
const url = require("rollup-plugin-url");
const peerDepsExternal = require("rollup-plugin-peer-deps-external");
const postcss = require("rollup-plugin-postcss");

const extensions = [".js", ".jsx", ".ts", ".tsx"]; // 어떤 확장자를 처리 할 지 정함

// babel-preset-react-app를 사용한다면 BABEL_ENV를 필수로 설정해야함.
process.env.BABEL_ENV = "production";

module.exports = {
  input: "./src/index.ts", // 어떤 파일부터 불러올지 정함.
  plugins: [
    peerDepsExternal(), // peerDependencies로 설치한 라이브러리들을 external 모듈로 설정
    resolve({ extensions }), // node_modules 에서 모듈을 불러올 수 있게 해줌. ts/tsx 파일도 불러올 수 있게 해줌
    commonjs({
      include: "node_modules/**",
    }), // CommonJS 형태로 만들어진 모듈도 불러와서 사용 할 수 있게 해줌. 현재 프로젝트 상황에서는 없어도 무방함
    babel({ extensions, include: ["src/**/*"], runtimeHelpers: true }), // Babel을 사용 할 수 있게 해줌
    url(), // 미디어 파일을 dataURI 형태로 불러와서 사용 할 수 있게 해줌.
    svgr(), // SVG를 컴포넌트로 사용 할 수 있게 해줌.
    postcss(),
  ],
  output: [
    {
      file: pkg.main, // CommonJS 파일
      format: "cjs",
    },
    {
      file: pkg.module, // ES 모듈 파일
      format: "es",
    },
  ],
  onwarn(warning, warn) {
    if (warning.code === "MODULE_LEVEL_DIRECTIVE") {
      return;
    }
    warn(warning);
  },
};
