# Manga Page Studio

通常のページ漫画を作るためのブラウザ版エディタです。

## できること

- ペン描画
- 消しゴム
- コマ枠作成
- 吹き出し作成
- 縦書きセリフ
- 画像素材の配置
- キャラ素材ライブラリ
- ストーリー文章からセリフ・シーン・コマ割りを自動生成
- ページ追加・複製
- ブラウザ保存・読込
- PNG書き出し
- 全ページPNG書き出し

## 使い方

`index.html` をブラウザで開くと使えます。

基本操作は、キャラ素材をアップロードして、ストーリーを入力し、`漫画を自動生成` を押すだけです。

ローカルURLで確認したい場合は、以下を実行してから `http://127.0.0.1:4177` を開きます。

```powershell
npm start
```

GPTでストーリーからセリフ・コマ割りを生成する場合は、`.env.example` を参考に `.env` を作り、`OPENAI_API_KEY` を設定します。

Web公開する場合は、`OPENAI_API_KEY` をサーバー側の環境変数に設定できるサービスで公開します。GPT接続を使う場合、静的サイトだけではなくサーバー側APIが必要です。

## Renderで公開

このフォルダをGitHubに置いて、RenderでWeb Serviceとして作成します。

- Build Command: `npm install`
- Start Command: `npm start`
- Environment Variable: `OPENAI_API_KEY`
- Optional Environment Variable: `OPENAI_MODEL=gpt-5.5`

Blueprintを使う場合は、リポジトリ直下の `render.yaml` をRenderで読み込めば同じ設定で作成できます。
