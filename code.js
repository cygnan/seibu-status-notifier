/**
 * まずスクリプトプロパティに以下の値を格納しておくこと。
 * 'A_DST_EMAIL_ADDR' = 運行情報送信先のメールアドレス
 * 'LAST_UPDATED_FROM_THE_PROPERTY' = '0'  // 値は'0'でなくても構わないが、''はNG。何か値を入れること。
 * 
 * A script for Google Apps Script that retrieves Seibu Railway service status, 
 *     and notifies you of that by e-mail.
 * @author supernova1987a
 * @copyright 2017 supernova1987a
 * @license MIT License <https://opensource.org/licenses/mit-license.php>
 */

function run() {
    try {
        var res = UrlFetchApp.fetch('https://www.seiburailway.jp/api/v1/servicestatus.jsonp');
        /** @type {boolean} */
        var wasFailureToFetch = res.getResponseCode() !== 200;
        if (wasFailureToFetch) throw new Error('Failed to fetch.');
        var jsonp = res.getContentText('UTF-8');
        var json = jsonp.toJson();
        /**
         * obj.IDS2Web[].chk               ：0->平常時, 全て1->運転支障時 @type {number}
         * obj.IDS2Web[].status_code       ：ステータスコード HPでは使用されず @example 200 @type {number} 
         * obj.IDS2Web[].text              ：運行情報のテキスト @type {string}
         * obj.IDS2Web[].tif[].pif[].ptn   ：振替輸送パターンの番号 @type {string}
         * obj.IDS2Web[].tif_all           ：振替輸送パターンの数だと思われる。HPでは使用されず @type {number}
         * obj.IDS2Web[0].time             ：最終更新時刻。IDS2WebPc.gifのURLクエリパラメータにのみ使われる。
         *                                      obj.IDS2Web[0].timeのみが使われる。 @type {string}
         */
        var obj = JSON.parse(json);
        var lastUpdated = obj.IDS2Web[0].time;
        const LAST_UPDATED_FROM_THE_PROPERTY = PropertiesService.getScriptProperties()
                                                   .getProperty('LAST_UPDATED_FROM_THE_PROPERTY');
        /** @type {boolean} */
        var isNewStatus = lastUpdated != LAST_UPDATED_FROM_THE_PROPERTY;
        /**
         * もし最終更新時刻が変わっていなかったら終了。
         * もし変わっていたら現在時刻とjsonpを記録して、メールを送信する。
         */
        if (!isNewStatus) {
            return;
        } else {
            /**
             * statusMessages[]
             * 運行情報のテキストの配列（複数あるかもしれないので配列）
             * @type {array}
             */
            var statusMessages = [];
            /**
             * alternativeStrs[]
             * 振替輸送一覧の文字列({string})が入った配列
             * @type {array}
             */
            var alternativeStrs = [];
            for (var g = 0; g < obj.IDS2Web.length; g++) {
                /** 運行情報のテキスト */
                statusMessages[g] = obj.IDS2Web[g].text;
                /**
                 * IDS2Web.lengthとtif.lengthとpif.lengthは全て同じ扱い。振替輸送パターン
                 * がどの場所に複数格納されていようと、でもHP上でのレイアウトは同じで、複
                 * 数枚の振替輸送一覧の画像が並ぶだけ。
                 */
                for (var h = 0; h < obj.IDS2Web[g].tif.length; h++) {
                    for (var j = 0; j < obj.IDS2Web[g].tif[h].pif.length; j++) {
                        /**
                         * alternativeNum
                         * 振替輸送パターンの番号
                         * @type {string}
                         */
                        var alternativeNum = obj.IDS2Web[g].tif[h].pif[j].ptn;
                        /**
                         * alternativeStr
                         * 振替輸送一覧の文字列
                         * @type {string}
                         */
                        /** 振替輸送パターンの番号を振替輸送一覧の文字列に変換する */
                        var alternativeStr = alternativeNum.convertAlternativeNumToStr();
                        /** 振替輸送一覧の文字列をalternativeStrs[]の末尾に追加する */
                        alternativeStrs.push(alternativeStr);
                    }
                }
            }

            /**
             * 緊急のお知らせをフェッチ
             * もしなかったら（obj2.Emergency[0].items == nullだったら）
             * 本文作成｜最終更新時刻＋運行情報全て＋振替輸送一覧全て
             * あったら
             * 本文作成｜緊急のお知らせ＋最終更新時刻＋運行情報全て＋振替輸送一覧全て
             * 
             * <未完成> convertAlternativeNumToStr()
             */

            /** 運行情報をメールで送信する */
            emailNotify(obj.IDS2Web[0].text);
            /** 現在の時刻をスクリプトプロパティに格納しておく */
            PropertiesService.getScriptProperties().setProperty('lastUpdated', lastUpdated);
            /** デバッグ用｜JSONPの値をそのままスクリプトプロパティに格納しておく */
            PropertiesService.getScriptProperties().setProperty('TEXT_' + now(), jsonp);
        }
        return; // とりあえずデバッグ用に追加した。
    } catch(e) {
        var errorKey = 'ERROR_' + now() + '_' + arguments.callee.name;
        var errorValue = e.name + ': ' + arguments.callee.name + '() | line '
            + e.lineNumber + ' | ' + e.message + '\n\nJSONP : ' + jsonp;
        /** デバッグ用｜エラーメッセージとそのときのJSONPの値をそのままスクリプトプロパティに格納しておく */
        PropertiesService.getScriptProperties().setProperty(errorKey, errorValue);
    }
}

/**
 * JSONPで書かれた文字列をJSONに変換する。
 * Objectにパースはしてくれないように変更。
 * @return {string} JSONフォーマットの文字列
 * @example
 * jsonp.toJson();
 * // return JSONフォーマットの文字列
 */
String.prototype.toJson = function() {
    try {
        /**
         * this
         * @type {string} JSONPフォーマットの文字列（もちろんJSONPフォーマットの文字列に対して使ったとき）
         */
        var json = this
        /** 最初に「sr_servicestatus_callback(」があったらカット */
        .replace(/(^sr_servicestatus_callback\()?/, '')
        /** 最初に「sr_emergency_callback(」があったらカット */
        .replace(/(^sr_emergency_callback\()?/, '')
        /** 最後の「)」をカット */
        .replace(/\)$/, '');
        return json;
    } catch(e) {
        var errorKey = 'ERROR_' + now() + '_' + 'toJson';
        var errorValue = e.name + ': ' + 'toJson' + '() | line '
            + e.lineNumber + ' | ' + e.message + '\n\nJSONP : ' + jsonp;
        /** デバッグ用｜エラーメッセージとそのときのJSONPの値をそのままスクリプトプロパティに格納しておく */
        PropertiesService.getScriptProperties().setProperty(errorKey, errorValue);
    }
}

/**
 * 振替輸送パターンの番号を振替輸送一覧の文字列に変換する。
 * @return {string} 
 * @example
 * alternativeNum.convertAlternativeNumToStr();
 * // return 振替輸送一覧の文字列
 */
String.prototype.convertAlternativeNumToStr = function() {
    try {
        /**
         * this
         * alternativeNum 振替輸送パターンの番号 {string} が入る
         * @type {string}
         */
        switch (this) {
            case '01':
                var alternativeStr = '';
                break;
            case '02':
                var alternativeStr = '';
                break;
            case '03':
                var alternativeStr = '';
                break;
            case '04':
                var alternativeStr = '';
                break;
            case '05':
                var alternativeStr = '';
                break;
            case '06':
                var alternativeStr = '';
                break;
            case '07':
                var alternativeStr = '';
                break;
            case '08':
                var alternativeStr = '';
                break;
            case '09':
                var alternativeStr = '';
                break;
            case '10':
                var alternativeStr = '';
                break;
            default:
                throw new Error('alternativeNum is invalid.');
                break;
        }
        return alternativeStr;
    } catch(e) {
        var errorKey = 'ERROR_' + now() + '_' + 'convertAlternativeNumtoStr';
        var errorValue = e.name + ': ' + 'convertAlternativeNumtoStr' + '() | line '
            + e.lineNumber + ' | ' + e.message + '\n\nJSONP : ' + jsonp;
        /** デバッグ用｜エラーメッセージとそのときのJSONPの値をそのままスクリプトプロパティに格納しておく */
        PropertiesService.getScriptProperties().setProperty(errorKey, errorValue);
    }
}

/**
 * 運行情報をメールで送信する
 * @param {string} status 運行情報のテキストつまりobj.IDS2Web[0].text
 * @example emailNotify('平常運転');
 * // A_DST_EMAIL_ADDR 宛に、本文に日付・時刻・「平常運転」が書かれたメールが送信される。
 */
var emailNotify = function(status) {
    try {
        const A_DST_EMAIL_ADDR = PropertiesService.getScriptProperties().getProperty('A_DST_EMAIL_ADDR');
        var body = '<html><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"></head><body>' + now() + ' 取得<br /><br />' + status + '</body></html>';
        GmailApp.sendEmail(A_DST_EMAIL_ADDR, '西武鉄道運行情報β', '', {htmlBody: body});
    } catch(e) {
        /** デバッグ用｜エラーメッセージとそのときのJSONPの値をそのままスクリプトプロパティに格納しておく */
        var errorKey = 'ERROR_' + now() + '_' + 'emailNotify';
        var errorValue = e.name + ': ' + 'emailNotify' + '() | line '
            + e.lineNumber + ' | ' + e.message + '\n\nJSONP : ' + jsonp;
        PropertiesService.getScriptProperties().setProperty(errorKey, errorValue);
    }
}

/*
 * フォーマットされた現在の日付と時刻を返す。
 * @return {string} 'MM/dd[EEE] hh:mm'｜ただしEEEは大文字
 * @example
 * now();
 * // return '02/27[MON] 22:37'
 */
var now = function() {
    var date = new Date();  // 現在日時を生成
    var obj = {
        MM: date.getMonth() + 1,  // 月を取得（返り値は実際の月-1なので、+1する）
        dd: date.getDate(),  // 日を取得
        hh: date.getHours(),  // 時を取得
        mm: date.getMinutes()  // 分を取得
    }
    /** 月、日、時、分が一桁の場合は先頭に0をつける */
    for (var ii in obj) {
        /** obj[ii]には obj.MM、obj.dd、obj.hh、obj.mm が入る */
        if (obj[ii] < 10) {
            obj[ii] = "0" + obj[ii].toString();
        }
    }
    var EEENum = date.getDay();  // 曜日を取得（数値）
    /** 曜日を数値から文字列に変換するための配列 */
    var week = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    /** 曜日を数値から文字列に変換 */
    var EEE = week[EEENum]
    /** フォーマットを整える */
    var result = obj.MM + '/' + obj.dd + '[' + EEE + '] ' + obj.hh + ':' + obj.mm;
    return result;
}

/**
function getEmergencyStatus() {
    try {
        var res = UrlFetchApp.fetch('https://www.seiburailway.jp/api/v1/servicestatus.jsonp');
        ** @type {boolean} *
        var wasFailureToFetch = res.getResponseCode() !== 200;
        if (wasFailureToFetch) throw new Error('Failed to fetch.');
        var jsonp = res.getContentText('UTF-8');
        var json = jsonp.toJson();
         **
         * obj2.chk         ：(謎) ex.1
         * obj2.items       ：(謎) ex.null
         * obj2.published   ：(謎 何かの文字列) ex.''
         * obj2.status_code ：ステータスコード  ex.200
         * obj2.text        ：(何か緊急の情報のテキスト？)
         * obj2.text_twitter：(何か緊急の情報のテキストのツイッター用短縮版？)
         * obj2.url         ：(関連する情報のURL？)                が入る
         *
        var obj2 = JSON.parse(json).Emergency[0];
        return obj2;
    } catch(e) {
        var errorKey = 'ERROR_' + now() + '_' + arguments.callee.name;
        var errorValue = e.toString() + '\n\nJSONP : ' + jsonp;
        ** デバッグ用｜エラーメッセージとそのときのJSONPの値をそのままスクリプトプロパティに格納しておく *
        PropertiesService.getScriptProperties().setProperty(errorKey, errorValue);
    }
}
*/
