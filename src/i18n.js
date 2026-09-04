export const localeOptions = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
]

export const messages = {
  'zh-CN': {
    nav: ['首页', '地图', '发布', '消息', '我的'], tabs: ['推荐', '附近', '关注'], follow: '关注',
    location: '曲院风荷 · 湖边慢行', sampleMedia: '示例影像', likes: '次赞', post: '把周末留给湖边的慢时光。沿着湖边，慢慢走一个下午。',
    comments: '查看全部 12 条评论', viewRoute: '查看游玩路线', routeMeta: '实地记录 · 3.8 km · 5 个节点', mapTitle: '地图发现',
    mapIntro: '在地图上发现附近的小众地点和路线。', filters: ['附近', '散步', '湖景'], routes: '条路线', viewPlace: '查看地点与路线',
    routeTitle: '湖畔慢行路线', duration: '实地记录 · 3.8 km · 约 1 小时 20 分', nodes: ['北侧步道入口', '林荫转弯处', '湖边休息点', '东侧出口'],
    photo2: '照片 2', media5: '照片 4 · 视频 1', navigate: '导航到入口', editorNodes: '路线节点', addNode: '＋ 添加节点', editor: '编辑游记',
    title: '标题', intro: '游玩介绍', introText: '从北侧入口沿湖慢慢走，沿途整理了适合停留的节点。', transport: '出行方式 · 选填', none: '不填写',
    walk: '步行', ride: '骑行', addMedia: '添加图片或视频', draft: '保存草稿', publish: '立即发布', publishHint: '发布后立即公开，积分审核通过后到账。',
    weekly: '本周热门地点', bio: '把走过的路分享给你', sampleData: '页面数据均为开发示例', mapSample: '示意地图 · 非真实导航数据',
    empty: '此页面将在下一阶段接入真实数据和业务状态。', names: ['曲院风荷', '九溪古道', '茅家埠水岸'], start: '起', end: '终', language: '语言', sampleTitle: '把周末留给湖边的慢时光',
    loadingFeed: '正在加载内容…', feedError: '内容加载失败', retry: '重试', demoPost: '暂无真实帖子，下面显示设计示例。', loginToLike: '登录后才能点赞。',
    searchTitle: '搜索山遥', searchHint: '搜索帖子、正文或地点', searchAction: '搜索', searchEmpty: '没有找到匹配内容。',
    rankingTitle: '点赞榜', rankingIntro: '按点赞数排序，同赞数时新发布的优先。', activityTitle: '消息与积分', noActivity: '暂时没有新消息。', pointBalance: '可用积分', pointPending: '待审核帖子通过后到账。',
    profileTitle: '我的山遥', signedInAs: '当前登录账号', signOut: '退出登录', loginRequired: '请先登录，再发布游记。', goLogin: '前往登录',
    adminTitle: '内容审核', adminEntry: '进入管理后台', noReview: '当前没有待审核帖子。', approve: '审核通过', remove: '下架', removalReason: '请输入下架原因',
    publishSuccess: '游记已公开发布，并进入审核队列。', placeName: '地点名称', city: '城市', startName: '起点名称', endName: '终点名称', latitude: '纬度', longitude: '经度', coordinateHint: '当前为手动坐标；接入地图 SDK 后改为地图选点。',
    auth: { welcome: '登录山遥', intro: '收藏远方，也记录自己的路。', wechat: '微信登录', qq: 'QQ 登录', google: 'Google 登录', quick: '快捷登录', divider: '或使用邮箱', email: '邮箱', password: '密码', emailHint: 'name@example.com', passwordHint: '至少 8 位', signIn: '邮箱登录', register: '注册账号', switchIn: '已有账号？登录', switchUp: '没有账号？注册', phone: '手机号登录', later: '后续开放', terms: '继续即表示你同意服务条款和隐私政策。', demoProvider: '等待配置第三方平台 App ID 与后端 OAuth 服务。', invalidEmail: '请输入有效的邮箱地址。', invalidPassword: '密码至少需要 8 位。', demoEmail: '表单验证通过，等待连接后端认证 API。', loading: '请稍候…', localVerified: '注册并验证成功，请登录。', checkEmail: '注册成功，请查收验证邮件。', signedIn: '登录成功。' },
  },
  en: {
    nav: ['Home', 'Map', 'Create', 'Activity', 'Profile'], tabs: ['For you', 'Nearby', 'Following'], follow: 'Follow',
    location: 'Quyuan Garden · Lakeside Walk', sampleMedia: 'Sample media', likes: 'likes', post: 'A slow weekend afternoon by the lake, with every useful stop saved along the way.',
    comments: 'View all 12 comments', viewRoute: 'View travel route', routeMeta: 'Recorded · 3.8 km · 5 stops', mapTitle: 'Explore map',
    mapIntro: 'Discover quiet places and community routes nearby.', filters: ['Nearby', 'Walking', 'Lake view'], routes: 'routes', viewPlace: 'View place and routes',
    routeTitle: 'Lakeside walking route', duration: 'Recorded · 3.8 km · about 1 hr 20 min', nodes: ['North trail entrance', 'Woodland bend', 'Lakeside rest stop', 'East exit'],
    photo2: '2 photos', media5: '4 photos · 1 video', navigate: 'Navigate to start', editorNodes: 'Route stops', addNode: '+ Add stop', editor: 'Edit story',
    title: 'Title', intro: 'Trip notes', introText: 'A gentle walk from the north entrance, with useful stops saved along the lake.', transport: 'Transport · Optional', none: 'Not specified',
    walk: 'Walking', ride: 'Cycling', addMedia: 'Add photos or videos', draft: 'Save draft', publish: 'Publish now', publishHint: 'Visible immediately. Points become available after review.',
    weekly: 'Popular this week', bio: 'Sharing the paths I have walked', sampleData: 'All data on this page is for development only', mapSample: 'Demo map · Not navigation data',
    empty: 'Real data and business states will be connected in the next phase.', names: ['Quyuan Garden', 'Nine Creeks Trail', 'Maojiabu Waterfront'], start: 'S', end: 'E', language: 'Language', sampleTitle: 'A slow weekend by the lake',
    loadingFeed: 'Loading stories…', feedError: 'Could not load stories', retry: 'Retry', demoPost: 'No published stories yet. A design sample is shown below.', loginToLike: 'Sign in to like this story.',
    searchTitle: 'Search Shanyao', searchHint: 'Search stories, text, or places', searchAction: 'Search', searchEmpty: 'No matching stories found.',
    rankingTitle: 'Like ranking', rankingIntro: 'Sorted by likes, then by newest when tied.', activityTitle: 'Activity and points', noActivity: 'No new activity yet.', pointBalance: 'Available points', pointPending: 'Points arrive after a story passes review.',
    profileTitle: 'My Shanyao', signedInAs: 'Signed in as', signOut: 'Sign out', loginRequired: 'Sign in before publishing a story.', goLogin: 'Go to sign in',
    adminTitle: 'Content review', adminEntry: 'Open admin console', noReview: 'There are no stories awaiting review.', approve: 'Approve', remove: 'Remove', removalReason: 'Enter the removal reason',
    publishSuccess: 'Your story is public and has entered the review queue.', placeName: 'Place name', city: 'City', startName: 'Start name', endName: 'End name', latitude: 'Latitude', longitude: 'Longitude', coordinateHint: 'Coordinates are entered manually until the map SDK is connected.',
    auth: { welcome: 'Sign in to Shanyao', intro: 'Save distant places and trace your own path.', wechat: 'Continue with WeChat', qq: 'Continue with QQ', google: 'Continue with Google', quick: 'Quick sign-in', divider: 'or use email', email: 'Email', password: 'Password', emailHint: 'name@example.com', passwordHint: 'At least 8 characters', signIn: 'Sign in with email', register: 'Create account', switchIn: 'Already registered? Sign in', switchUp: 'New here? Create account', phone: 'Phone sign-in', later: 'Coming later', terms: 'By continuing, you agree to the Terms and Privacy Policy.', demoProvider: 'Requires provider App IDs and the backend OAuth service.', invalidEmail: 'Enter a valid email address.', invalidPassword: 'Password must contain at least 8 characters.', demoEmail: 'Validation passed. Waiting for the authentication API.', loading: 'Please wait…', localVerified: 'Registration and verification succeeded. Please sign in.', checkEmail: 'Registration succeeded. Check your email to verify the account.', signedIn: 'Signed in successfully.' },
  },
  ja: {
    nav: ['ホーム', '地図', '投稿', 'お知らせ', 'マイページ'], tabs: ['おすすめ', '近く', 'フォロー中'], follow: 'フォロー',
    location: '曲院風荷 · 湖畔散歩', sampleMedia: 'サンプル画像', likes: '件のいいね', post: '週末の午後を湖畔でゆっくり。立ち寄りたい場所をルートにまとめました。',
    comments: 'コメント12件をすべて見る', viewRoute: '散策ルートを見る', routeMeta: '実地記録 · 3.8 km · 5地点', mapTitle: '地図で探す',
    mapIntro: '近くの静かな場所とみんなのルートを探しましょう。', filters: ['近く', '散歩', '湖'], routes: 'ルート', viewPlace: '場所とルートを見る',
    routeTitle: '湖畔の散策ルート', duration: '実地記録 · 3.8 km · 約1時間20分', nodes: ['北側遊歩道入口', '木陰の曲がり角', '湖畔の休憩所', '東側出口'],
    photo2: '写真2枚', media5: '写真4枚 · 動画1本', navigate: '入口まで案内', editorNodes: 'ルート地点', addNode: '＋ 地点を追加', editor: '旅行記を編集',
    title: 'タイトル', intro: '旅行メモ', introText: '北側入口から湖畔を歩き、立ち寄りたい地点をまとめました。', transport: '移動手段 · 任意', none: '指定なし',
    walk: '徒歩', ride: '自転車', addMedia: '写真・動画を追加', draft: '下書き保存', publish: '今すぐ公開', publishHint: '投稿後すぐ公開され、審査後にポイントが付与されます。',
    weekly: '今週の人気スポット', bio: '歩いた道をシェアします', sampleData: '画面のデータは開発用サンプルです', mapSample: 'サンプル地図 · ナビデータではありません',
    empty: '実データと業務状態は次の段階で接続します。', names: ['曲院風荷', '九渓古道', '茅家埠水辺'], start: '始', end: '終', language: '言語', sampleTitle: '湖畔で過ごす静かな週末',
    loadingFeed: '投稿を読み込み中…', feedError: '投稿を読み込めませんでした', retry: '再試行', demoPost: '公開投稿がないため、デザインサンプルを表示しています。', loginToLike: 'いいねするにはログインしてください。',
    searchTitle: '山遥を検索', searchHint: '投稿、本文、場所を検索', searchAction: '検索', searchEmpty: '一致する投稿はありません。',
    rankingTitle: 'いいねランキング', rankingIntro: 'いいね数順、同数の場合は新しい投稿を優先します。', activityTitle: 'お知らせとポイント', noActivity: '新しいお知らせはありません。', pointBalance: '利用可能ポイント', pointPending: '投稿の審査通過後に付与されます。',
    profileTitle: 'マイ山遥', signedInAs: 'ログイン中', signOut: 'ログアウト', loginRequired: '投稿する前にログインしてください。', goLogin: 'ログインへ',
    adminTitle: 'コンテンツ審査', adminEntry: '管理画面を開く', noReview: '審査待ちの投稿はありません。', approve: '承認', remove: '非公開', removalReason: '非公開の理由を入力',
    publishSuccess: '投稿を公開し、審査待ちになりました。', placeName: '場所名', city: '都市', startName: '出発地点', endName: '到着地点', latitude: '緯度', longitude: '経度', coordinateHint: '地図 SDK 接続までは座標を手動入力します。',
    auth: { welcome: '山遥にログイン', intro: '遠い景色を保存し、自分の道を記録しよう。', wechat: 'WeChatでログイン', qq: 'QQでログイン', google: 'Googleでログイン', quick: 'クイックログイン', divider: 'またはメールを使用', email: 'メール', password: 'パスワード', emailHint: 'name@example.com', passwordHint: '8文字以上', signIn: 'メールでログイン', register: 'アカウント登録', switchIn: '登録済みですか？ログイン', switchUp: '初めてですか？登録', phone: '電話番号でログイン', later: '今後対応', terms: '続行すると、利用規約とプライバシーポリシーに同意したものとみなされます。', demoProvider: '各サービスのApp IDとバックエンドOAuth設定が必要です。', invalidEmail: '有効なメールアドレスを入力してください。', invalidPassword: 'パスワードは8文字以上必要です。', demoEmail: '入力確認完了。認証APIへの接続待ちです。', loading: 'しばらくお待ちください…', localVerified: '登録と確認が完了しました。ログインしてください。', checkEmail: '登録しました。確認メールをご確認ください。', signedIn: 'ログインしました。' },
  },
}

export function detectLocale() {
  const saved = localStorage.getItem('shanyao-locale')
  if (messages[saved]) return saved
  const browser = navigator.language || 'zh-CN'
  if (browser.startsWith('ja')) return 'ja'
  if (browser.startsWith('en')) return 'en'
  return 'zh-CN'
}
