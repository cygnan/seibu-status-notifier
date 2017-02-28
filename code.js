/**
 * まずスクリプトプロパティに以下の値を格納しておくこと。
 * 'A_DST_EMAIL_ADDR' = 運行情報送信先のメールアドレス
 * 'obj.time' = '0'  // 値は'0'でなくても構わないが、''はNG。何か値を入れること。
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
         * obj.chk         ：(謎) ex.0
         * obj.status_code ：ステータスコード  ex.200
         * obj.text        ：運行情報のテキスト
         * obj.time        ：最終更新日時
         * obj.tif[].pif[] ：(振替輸送？)
         * obj.tif_all     ：(振替輸送全区間？)
         * obj.time        ：最終更新日時               が入る
         */
        var obj = JSON.parse(json).IDS2Web[0];
        const TIME_FROM_THE_PROPERTY = PropertiesService.getScriptProperties().getProperty('obj.time');
        /** @type {boolean} */
        var isNewStatus = obj.time != TIME_FROM_THE_PROPERTY;
        /**
         * もし最終更新時刻が変わっていなかったら終了。
         * もし変わっていたら現在時刻とjsonpを記録して、メールを送信する。
         */
        if (!isNewStatus) {
            return;
        } else {
            /** 現在の時刻をスクリプトプロパティに格納しておく */
            PropertiesService.getScriptProperties().setProperty('obj.time', obj.time);
            /** 運行情報をメールで送信する */
            emailNotify(obj.text);
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
 * 運行情報をメールで送信する
 * @param {string} status 運行情報のテキストつまりobj.text
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
