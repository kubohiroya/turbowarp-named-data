# Named Dataの最小デモ

- [TurboWarp Editor](https://turbowarp.org/editor?project_url=https%3A%2F%2Fkubohiroya.github.io%2Fturbowarp-named-data%2Fsamples%2Fregistry-availability.sb3) / [SB3](https://kubohiroya.github.io/turbowarp-named-data/samples/registry-availability.sb3)
- 操作: **Run without sandbox**を選び**Allow**し、緑の旗を押します。
- 期待結果: registry利用可能がtrueになります。停止後の再実行でも確認できます。
- 設定: このサンプルの起動設定だけを拡張構築中に有効にし、直後に元のglobal descriptorへ復元します。本体の既定OFFは変更しません。

`manifest.json`に配信先・拡張ID・sandbox条件・起動設定・期待値を記録しています。`registry-availability/project.json`と自作`backdrop.svg`を編集し、`.nvmrc`指定のNode.jsで再生成してください。生成に追加依存はありません。全文出力はVariablesで表示できます。

```bash
pnpm run samples:build
pnpm run samples:check
pnpm run pages:build
```

生成したSB3もコミットします。Pagesは既存docs・dist・SB3を`_site/`へまとめます。unsandboxed拡張は検証対象JSをSB3へ同梱し、通常の同意画面で許可します。sandbox互換拡張はPagesのJSを参照します。緑の旗で入力から毎回結果を生成します。停止後の再実行も可能です。切戻しはこのPRをrevertしPagesを再配信します。
