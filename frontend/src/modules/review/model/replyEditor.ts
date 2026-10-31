import type { InjectionKey, Ref } from 'vue'

/** 同一点评列表及其历史面板只打开一个编辑框；切换时组件仍保存各自草稿。 */
export const activeReplyEditorKey: InjectionKey<Ref<string | null>> = Symbol('active-reply-editor')
/** 历史面板关闭后停止不可见回复读取，保留缓存和草稿供重新打开。 */
export const replyScopeVisibleKey: InjectionKey<Readonly<Ref<boolean>>> =
  Symbol('reply-scope-visible')
