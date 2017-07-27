// まずスクリプトプロパティに以下の値を格納しておくこと。
// 'A_DST_EMAIL_ADDR' = 運行情報送信先のメールアドレス

/** 
 * @description [UNRELEASED] A script for Google Apps Script to retrieve Seibu
 *     Railway service status and notify the user via e-mail.
 * @author Cygnan
 * @copyright 2017 Cygnan
 * @license MIT License <https://opensource.org/licenses/mit-license.php>
 */

function run() {
    try {
        var res = UrlFetchApp.fetch(
            'https://www.seiburailway.jp/api/v1/servicestatus.jsonp',
            { muteHttpExceptions: true }
        );

        /** @type {boolean} */
        var wasFailureToFetch = res.getResponseCode() !== 200;

        if (wasFailureToFetch) return;

        var jsonp = res.getContentText('UTF-8');

        if (!jsonp) return; // 万一jsonpに何も入っていなかったときのバグ防止

        var json = jsonp.jsonp2json();

        // obj.IDS2Web[].chk             ：0->平常時, 全て1->運転支障時
        //                                 @type {number}
        // obj.IDS2Web[].status_code     ：ステータスコード HPでは使用されず
        //                                 @example 200
        //                                 @type {number} 
        // obj.IDS2Web[].text            ：運行情報のテキスト
        //                                 @type {string}
        // obj.IDS2Web[].tif[].pif[].ptn ：振替輸送パターンの番号
        //                                 @type {string}
        // obj.IDS2Web[].tif_all         ：振替輸送パターンの数 HPでは使用されず
        //                                 @type {number}
        // obj.IDS2Web[0].time           ：最終更新時刻。IDS2WebPc.gifのURLクエ
        //                                 リパラメータにのみ使われる。
        //                                 obj.IDS2Web[0].timeのみが使われる。
        //                                 @type {string}

        var obj = JSON.parse(json);

        // 万一obj.IDS2Web、obj.IDS2Web[0]、obj.IDS2Web[0].timeに何も入っていな
        // かったときのバグ防止（HPを見る限りはありえないが念のためチェック）
        if (!obj.IDS2Web || !obj.IDS2Web[0] || !obj.IDS2Web[0].time) return;

        var lastUpdatedStr = obj.IDS2Web[0].time;

        var lastUpdatedNum = Number(lastUpdatedStr);

        const LAST_UPDATED_NUM_FROM_THE_PROPERTY =
            PropertiesService.getScriptProperties().
                getProperty('LAST_UPDATED_NUM_FROM_THE_PROPERTY');
        
        if (!LAST_UPDATED_NUM_FROM_THE_PROPERTY) {
            // もしLAST_UPDATED_NUM_FROM_THE_PROPERTYというプロパティが見つから
            // なかったら（i.e. nullだったら）そのまま進む（i.e. 初回実行時には
            // 実行するということ）
            /** @type {boolean} */
            var isNewStatus = true;
        } else {
            /** @type {boolean} */
            var isNewStatus =
                lastUpdatedNum > LAST_UPDATED_NUM_FROM_THE_PROPERTY;
        }

        // もし最終更新時刻が変わっていなかったら終了
        if (!isNewStatus) return;

        // ここから最終更新時刻が変わっていた場合

        // 現在の時刻をスクリプトプロパティに格納しておく
        PropertiesService.getScriptProperties().
            setProperty('LAST_UPDATED_NUM_FROM_THE_PROPERTY', lastUpdatedNum);

        /**
         * statusMsgs[]
         * 運行情報のテキストが複数入った配列
         * @type {array}
         */
        var statusMsgs = [];

        /**
         * alternativeTexts[]
         * 振替輸送一覧のテキスト(alternativeText {string})が複数入った配列
         * @type {array}
         */
        var alternativeTexts = [];

        for (var g = 0; g < obj.IDS2Web.length; g++) {
            // 万一obj.IDS2Web[g].textに何も入っていなかったときのバグ防止
            // （HPを見る限りはありえないが念のためチェック）
            if (obj.IDS2Web[g].text) {
                statusMsgs.push(obj.IDS2Web[g].text); // 運行情報のテキスト
            }

            // IDS2Web.lengthとtif.lengthとpif.lengthは全て同じ扱い。振替輸送パ
            // ターンがどの場所に複数格納されていようと、HP上でのレイアウトは同
            // じで、複数枚の振替輸送一覧の画像が並ぶだけ。
            for (var h = 0; h < obj.IDS2Web[g].tif.length; h++) {
                for (var j = 0; j < obj.IDS2Web[g].tif[h].pif.length; j++) {
                    // 万一obj.IDS2Web[g].tif[h].pif[j].ptnに何も入っていなかっ
                    // たときのバグ防止（HPを見る限りはありえないが念のためチェ
                    // ック）
                    if (!obj.IDS2Web[g].tif[h].pif[j].ptn) continue;

                    /**
                     * alternativeNum
                     * 振替輸送パターンの番号
                     * @type {string}
                     */
                    var alternativeNum = obj.IDS2Web[g].tif[h].pif[j].ptn;

                    /**
                     * alternativeText
                     * 振替輸送一覧のテキスト１つ
                     * @type {string}
                     */
                    // 振替輸送パターンの番号を振替輸送一覧のテキストに変換
                    var alternativeText = alternativeNum.alternativeNum2text();
                    
                    /**
                     * isInvalid
                     * もしalternativeNumが'01'～'10'ではなかったらtrue
                     * @type {boolean}
                     */
                    var isInvalid = alternativeText === 'Invalid';

                    // もしalternativeNumが'01'～'10'ではなかったらcontinue
                    // （バグ防止のため念のためチェック）
                    if (isInvalid) continue;

                    /**
                     * 振替輸送一覧のテキストをalternativeTexts[]の末尾に追加
                     */
                    alternativeTexts.push(alternativeText);
                }
            }
        }

        /**
         * noAlternatives
         * 振替輸送がないときtrue（alternativeTextsが空配列であるときtrue）
         * @type {boolean}
         */
        var noAlternatives = alternativeTexts.length == 0;

        if (noAlternatives) { // 振替輸送がないとき
            var bodyWithoutHeadOrFormattedTime =
                statusMsgs.join('<br /><br />');
        } else { // 振替輸送が１つ以上あるとき
            var bodyWithoutHeadOrFormattedTime = [
                statusMsgs.join('<br /><br />'),
                ,
                alternativeTexts.join('<br /><br />')
            ].join('<br />');
        }

        const BODY_WITHOUT_HEAD_OR_FORMATTED_TIME_FROM_THE_PROPERTY =
            PropertiesService.getScriptProperties().getProperty(
                'BODY_WITHOUT_HEAD_OR_FORMATTED_TIME_FROM_THE_PROPERTY'
            );

        var isNewBody =
            bodyWithoutHeadOrFormattedTime !=
            BODY_WITHOUT_HEAD_OR_FORMATTED_TIME_FROM_THE_PROPERTY;

        if (!isNewBody) return; // もし運行情報が変わっていなかったら終了

        var bodyWithoutHead = [
            formattedTime(lastUpdatedStr) + ' 現在',
            ,
            bodyWithoutHeadOrFormattedTime
        ].join('<br />');

        // 運行情報をメールで送信する
        emailNotify(bodyWithoutHead);

        // デバッグ用｜JSONPの値をそのままスクリプトプロパティに格納しておく
        PropertiesService.getScriptProperties().
            setProperty('TEXT_' + formattedTime('now'), jsonp);

        // 現在の運行情報をスクリプトプロパティに格納しておく
        PropertiesService.getScriptProperties().
            setProperty(
            'BODY_WITHOUT_HEAD_OR_FORMATTED_TIME_FROM_THE_PROPERTY',
            bodyWithoutHeadOrFormattedTime
            );

        return; // とりあえずデバッグ用に追加した。
    } catch (e) {
        var errorKey = 'ERROR_' + formattedTime('now') + '_' +
            arguments.callee.name;
        
        var errorValue = e.name + ': ' + arguments.callee.name + '() | line ' +
            e.lineNumber + ' | ' + e.message + '\n\nJSONP : ' +
            jsonp;
        
        /**
         * isFetchingError
         * いつものフェッチ時の予期せぬエラーならtrue
         * @type {boolean}
         */
        var isFetchingError = errorValue === 'Exception: run() | line 16 | Un' +
            'expected error: https://www.seiburailway.jp/api/v1/servicestatus' +
            '.jsonp\n\nJSONP : undefined';
        
        // いつものフェッチ時の予期せぬエラーは記録から除外したいので return
        if (isFetchingError) return;

        // デバッグ用｜エラーメッセージとそのときのJSONPの値をそのままスクリプト
        // プロパティに格納しておく
        PropertiesService.getScriptProperties().
            setProperty(errorKey, errorValue);
    }
}

/**
 * JSONPで書かれた文字列をJSONに変換する。
 * Objectにパースはしてくれないように変更。
 * @return {string} JSONフォーマットの文字列
 * @example
 * jsonp.jsonp2json();
 * // return JSONフォーマットの文字列
 */
String.prototype.jsonp2json = function () {
    try {
        /**
         * jsonp
         * JSONPフォーマットの文字列
         * (もちろんこのメソッドをJSONPフォーマットの文字列に対して使ったとき)
         * @type {string}
         */
        var jsonp = this.toString();

        var json = jsonp.
            // 最初に「sr_servicestatus_callback(」があったらカット
            replace(/(^sr_servicestatus_callback\()?/, '').
            // 最初に「sr_emergency_callback(」があったらカット
            replace(/(^sr_emergency_callback\()?/, '').
            // 最後の「)」をカット
            replace(/\)$/, '');

        return json;
    } catch (e) {
        var errorKey = 'ERROR_' + formattedTime('now') + '_' + 'jsonp2json';

        var errorValue = e.name + ': ' + 'jsonp2json' + '() | line ' +
            e.lineNumber + ' | ' + e.message + '\n\nJSONP : ' +
            jsonp;
        
        // デバッグ用｜エラーメッセージとそのときのJSONPの値をそのままスクリプト
        // プロパティに格納しておく
        PropertiesService.getScriptProperties().
            setProperty(errorKey, errorValue);
    }
};

/**
 * 振替輸送パターンの番号を振替輸送一覧のテキストに変換する。
 * @return {string} 
 * @example
 * alternativeNum.alternativeNum2text();
 * // return 振替輸送一覧のテキスト
 */
String.prototype.alternativeNum2text = function () {
    try {
        /**
         * alternativeNum
         * 振替輸送パターンの番号
         * @type {string}
         */
        var alternativeNum = this.toString();

        switch (alternativeNum) {
            case '01':
                var alternativeText = [
                    '■池袋線（池袋～飯能駅間）・西武有楽町線における振替輸送' +
                    'のご案内',
                    ,
                    'ＪＲ山手線',
                    '・池袋～新宿',
                    'ＪＲ埼京・川越線',
                    '・新宿～大宮～高麗川',
                    'ＪＲ中央線',
                    '・新宿～立川',
                    'ＪＲ武蔵野線',
                    '・西国分寺～武蔵浦和',
                    'ＪＲ八高線',
                    '・拝島～寄居',
                    'ＪＲ青梅線',
                    '・立川～拝島',
                    '東京メトロ線',
                    '・全線',
                    '都営地下鉄線',
                    '・全線',
                    '東武東上線',
                    '・全線',
                    '東武越生線',
                    '・全線',
                    '多摩モノレール線',
                    '・玉川上水～立川南',
                    '秩父鉄道線',
                    '・寄居～御花畑'
                ].join('<br />');

                break;
            case '02':
                var alternativeText = [
                    '■西武新宿～本川越駅間における振替輸送のご案内',
                    ,
                    'ＪＲ山手線',
                    '・池袋～新宿',
                    'ＪＲ埼京・川越線',
                    '・新宿～大宮～高麗川',
                    'ＪＲ中央線',
                    '・新宿～立川',
                    'ＪＲ武蔵野線',
                    '・西国分寺～武蔵浦和',
                    'ＪＲ八高線',
                    '・拝島～高麗川',
                    'ＪＲ青梅線',
                    '・立川～拝島',
                    '東京メトロ線',
                    '・全線',
                    '都営地下鉄線',
                    '・全線',
                    '東武東上線',
                    '・池袋～川越市',
                    '京王線',
                    '・新宿～明大前',
                    '京王井の頭線',
                    '・全線',
                    '多摩モノレール線',
                    '・玉川上水～立川南'
                ].join('<br />');

                break;
            case '03':
                var alternativeText = [
                    '■所沢～飯能駅間における振替輸送のご案内',
                    ,
                    'ＪＲ山手線',
                    '・池袋～新宿',
                    'ＪＲ埼京・川越線',
                    '・新宿～大宮～高麗川',
                    'ＪＲ中央線',
                    '・新宿～立川',
                    'ＪＲ武蔵野線',
                    '・西国分寺～武蔵浦和',
                    'ＪＲ八高線',
                    '・拝島～寄居',
                    'ＪＲ青梅線',
                    '・立川～拝島',
                    '東京メトロ線',
                    '・全線',
                    '東武東上線',
                    '・池袋～寄居',
                    '東武越生線',
                    '・坂戸～越生',
                    '秩父鉄道線',
                    '・寄居～御花畑',
                    '多摩モノレール線',
                    '・玉川上水～立川南'
                ].join('<br />');

                break;
            case '04':
                var alternativeText = [
                    '■所沢～本川越駅間における振替輸送のご案内',
                    ,
                    'ＪＲ山手線',
                    '・池袋～新宿',
                    'ＪＲ埼京・川越線',
                    '・新宿～大宮～高麗川',
                    'ＪＲ中央線',
                    '・新宿～立川',
                    'ＪＲ武蔵野線',
                    '・西国分寺～武蔵浦和',
                    'ＪＲ八高線',
                    '・拝島～高麗川',
                    'ＪＲ青梅線',
                    '・立川～拝島',
                    '東京メトロ線',
                    '・全線',
                    '東武東上線',
                    '・池袋～川越市',
                    '多摩モノレール線',
                    '・玉川上水～立川南'
                ].join('<br />');

                break;
            case '05':
                var alternativeText = [
                    '■拝島線、国分寺線、多摩湖線における振替輸送のご案内',
                    ,
                    'ＪＲ山手線',
                    '・池袋～新宿',
                    'ＪＲ中央線',
                    '・新宿～立川',
                    'ＪＲ武蔵野線',
                    '・西国分寺～新秋津',
                    'ＪＲ八高線',
                    '・拝島～東飯能',
                    'ＪＲ青梅線',
                    '・立川～拝島',
                    '東京メトロ線',
                    '・全線',
                    '多摩モノレール線',
                    '・玉川上水～立川南'
                ].join('<br />');

                break;
            case '06':
                var alternativeText = [
                    '■池袋線、西武秩父線（飯能～西武秩父駅間）における振替輸' +
                    '送のご案内',
                    ,
                    'ＪＲ山手線',
                    '・池袋～新宿',
                    'ＪＲ埼京・川越線',
                    '・新宿～大宮～高麗川',
                    'ＪＲ中央線',
                    '・新宿～立川',
                    'ＪＲ武蔵野線',
                    '・西国分寺～武蔵浦和',
                    'ＪＲ八高線',
                    '・拝島～寄居',
                    'ＪＲ青梅線',
                    '・立川～拝島',
                    '東京メトロ線',
                    '・全線',
                    '東武東上線',
                    '・池袋～寄居',
                    '東武越生線',
                    '・坂戸～越生',
                    '秩父鉄道線',
                    '・寄居～御花畑'
                ].join('<br />');

                break;
            case '07':
                var alternativeText = [
                    '■西武有楽町線における振替輸送のご案内',
                    ,
                    'ＪＲ山手線',
                    '・池袋～新宿',
                    'ＪＲ中央線',
                    '・新宿～中野',
                    '東京メトロ線',
                    '・全線',
                    '都営地下鉄線',
                    '・全線',
                    '東武東上線',
                    '・池袋～川越市'
                ].join('<br />');

                break;
            case '08':
                var alternativeText = [
                    '■多摩川線における振替輸送のご案内',
                    ,
                    'ＪＲ中央線',
                    '・新宿～立川',
                    'ＪＲ武蔵野線',
                    '・府中本町～西国分寺',
                    'ＪＲ南武線',
                    '・立川～南多摩',
                    '京王線',
                    '・新宿～分倍河原'
                ].join('<br />');

                break;
            case '09':
                var alternativeText = [
                    '■振替輸送のご案内',
                    ,
                    'ＪＲ山手線',
                    '・池袋～新宿',
                    'ＪＲ埼京・川越線',
                    '・新宿～大宮～高麗川',
                    'ＪＲ中央線',
                    '・新宿～立川',
                    'ＪＲ武蔵野線',
                    '・西国分寺～武蔵浦和',
                    'ＪＲ八高線',
                    '・拝島～寄居',
                    'ＪＲ青梅線',
                    '・立川～拝島',
                    'ＪＲ南武線　　　',
                    '・立川～南多摩',
                    '東京メトロ線',
                    '・全線',
                    '都営地下鉄線',
                    '・全線',
                    '東武東上線',
                    '・池袋～寄居',
                    '東武越生線',
                    '・坂戸～越生',
                    '京王線',
                    '・新宿～分倍河原',
                    '京王井の頭線',
                    '・全線',
                    '秩父鉄道線',
                    '・寄居～御花畑',
                    '多摩モノレール線',
                    '・玉川上水～立川南'
                ].join('<br />');

                break;
            case '10':
                var alternativeText = [
                    '■池袋線（池袋～飯能駅間）・西武有楽町線における振替輸送' +
                    'のご案内',
                    ,
                    'ＪＲ山手線',
                    '・池袋～新宿',
                    'ＪＲ埼京・川越線',
                    '・新宿～大宮～高麗川',
                    'ＪＲ中央線',
                    '・新宿～立川',
                    'ＪＲ武蔵野線',
                    '・西国分寺～武蔵浦和',
                    'ＪＲ八高線',
                    '・拝島～寄居',
                    'ＪＲ青梅線',
                    '・立川～拝島',
                    '東京メトロ線',
                    '・全線',
                    '都営地下鉄線',
                    '・全線',
                    '東武東上線',
                    '・池袋～寄居',
                    '東武越生線',
                    '・坂戸～越生',
                    '秩父鉄道線',
                    '・寄居～御花畑',
                    '多摩モノレール線',
                    '・玉川上水～立川南'
                ].join('<br />');

                break;
            default:
                var alternativeText = 'Invalid';

                break;
        }
        
        return alternativeText;
    } catch (e) {
        var errorKey = 'ERROR_' + formattedTime('now') + '_' +
            'alternativeNum2text';
        
        var errorValue = e.name + ': ' + 'alternativeNum2text' + '() | line ' +
            e.lineNumber + ' | ' + e.message;
        
        //　デバッグ用｜エラーメッセージをそのままスクリプトプロパティに格納して
        // おく
        PropertiesService.getScriptProperties().
            setProperty(errorKey, errorValue);
    }
};

/**
 * 運行情報をメールで送信する
 * @param {string} bodyWithoutHead 送信メール本文（<body></body>で囲まれた部分）
 * @example emailNotify('平常運転');
 * // A_DST_EMAIL_ADDR 宛に、本文に「平常運転」が書かれたメールが送信される。
 */
var emailNotify = function (bodyWithoutHead) {
    try {
        const A_DST_EMAIL_ADDR = PropertiesService.getScriptProperties().
            getProperty('A_DST_EMAIL_ADDR');
        
        var body = '<html><head><meta http-equiv="Content-Type" content="text' +
            '/html; charset=UTF-8"></head><body>' + bodyWithoutHead +
            '</body></html>';
        
        GmailApp.sendEmail(A_DST_EMAIL_ADDR, '西武鉄道運行情報β',
            '', { htmlBody: body });
    } catch (e) {
        // デバッグ用｜エラーメッセージをそのままスクリプトプロパティに格納し
        // ておく
        var errorKey = 'ERROR_' + formattedTime('now') + '_' + 'emailNotify';

        var errorValue = e.name + ': ' + 'emailNotify' + '() | line ' +
            e.lineNumber + ' | ' + e.message;
        
        PropertiesService.getScriptProperties().
            setProperty(errorKey, errorValue);
    }
};

/**
 * フォーマットされた日付と時刻を返す。
 * @param {?string} dateStr
 *     引数なし || 'now' -> 現在日時をフォーマットしてから返す。
 *     引数が'yyyyMMddhhmmss' -> 与えられた日時をフォーマットしてから返す。
 * @return {string} 'MM/dd[EEE] hh:mm'｜ただしEEEは大文字
 * @example
 * formattedTime();
 * // return '02/27[MON] 22:37' // 現在日時
 * formattedTime('20170228173704');
 * // return '02/28[TUE] 17:37' // 与えられた日時
 */
var formattedTime = function (dateStr) {
    try {
        if (!dateStr || dateStr === 'now') { // 引数なし || 引数が 'now' のとき
            var date = new Date(); // 現在日時を生成
        } else {
            /**
             * dateStr4newDate
             * new Date() に入れられるようにフォーマットされた日時
             * @type {string}
             * @example '2017/02/28 17:37'
             */
            var dateStr4newDate = dateStr.slice(0, 4) + '/' +
                dateStr.slice(4, 6) + '/' +
                dateStr.slice(6, 8) + ' ' +
                dateStr.slice(8, 10) + ':' +
                dateStr.slice(10, 12);
            
            var date = new Date(dateStr4newDate); // 与えられた日時を生成

            /** @type {boolean} */
            var isAnInvalidDate = date.toString() == "Invalid Date";

            if (isAnInvalidDate) throw new Error('dateStr is invalid.');
        }

        var obj = {
            MM: date.getMonth() + 1, // 月を取得（実際の月にするために+1する）
            dd: date.getDate(), // 日を取得
            hh: date.getHours(), // 時を取得
            mm: date.getMinutes() // 分を取得
        };

        // 月、日、時、分が一桁の場合は先頭に0をつける
        for (var ii in obj) {
            // obj[ii]には obj.MM、obj.dd、obj.hh、obj.mm が入る
            if (obj[ii] < 10) {
                obj[ii] = "0" + obj[ii].toString();
            } else {
                // 既に２桁だった場合は数値のままなので、念のため文字列に変換し
                // ておく。
                obj[ii] = obj[ii].toString();
            }
        }
        var EEENum = date.getDay(); // 曜日を取得（数値）

        // 曜日を数値から文字列に変換するための配列
        var week = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

        // 曜日を数値から文字列に変換
        var EEE = week[EEENum];

        // フォーマットを整える
        var result = obj.MM + '/' + obj.dd + '[' + EEE + '] ' + obj.hh + ':' +
            obj.mm;
        
        return result;
    } catch (e) {
        // デバッグ用｜エラーメッセージをそのままスクリプトプロパティに格納して
        // おく
        var errorKey = 'ERROR_' + formattedTime('now') + '_' + 'formattedTime';

        var errorValue = e.name + ': ' + 'formattedTime' + '() | line ' +
            e.lineNumber + ' | ' + e.message;
        
        PropertiesService.getScriptProperties().
            setProperty(errorKey, errorValue);
    }
};
