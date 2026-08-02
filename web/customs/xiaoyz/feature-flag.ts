// 定制 by chengm xiaoyz抽卡模块 feature flag start
/** xiaoyz 小冒险抽卡模块 — 功能开关 */

export const isXiaoyzEnabled = () => {
  // 可通过环境变量控制功能开关
  return process.env.NEXT_PUBLIC_ENABLE_XIAOYZ !== 'false'
}
// 定制 by chengm xiaoyz抽卡模块 feature flag end
