		/*
		 * まずスクリプトプロパティに以下の値を格納しておくこと。
		 * 'myMobileMail' = 運行情報送信先のメールアドレス
		 * 'obj.time' = '0'　//値は'0'でなくても構わないが、''はNG。何か値を入れること。
		 */

function run() {
  try {
    var res = UrlFetchApp.fetch('https://www.seiburailway.jp/api/v1/servicestatus.jsonp');
    if (res.getResponseCode() !== 200) throw new Error('Not Found');
    var jsonp = res.getContentText('UTF-8');
		var json = cnvJsonpToJson(jsonp);
		/*
		 *　obj.chk					：(謎) ex.0
		 *	obj.status_code ：ステータスコード　ex.200
		 *	obj.text 				：運行情報のテキスト
		 *　obj.time				：最終更新日時
		 *	obj.tif[].pif[]	：(振替輸送？)
		 *	obj.tif_all			：(振替輸送全区間？)
		 *	obj.time				：最終更新日時								が入るようにする。
		 */
		var obj = JSON.parse(json).IDS2Web[0];
    var timeFromTheProperty = PropertiesService.getScriptProperties().getProperty('obj.time');
    //もし最終更新時刻が変わってなかったら終了。もし変わっていたら現在時刻とjsonpを記録して、メールを送信する。
    if (obj.time == timeFromTheProperty) {
    	return;
    } else {
    	PropertiesService.getScriptProperties().setProperty('obj.time', obj.time);
    	//運行情報をメールで送信する
    	emailNotify(obj.text);
    	//デバッグ用｜JSONPの値をそのままスクリプトプロパティに格納しておく
    	PropertiesService.getScriptProperties().setProperty('TEXT_' + now(), jsonp);
    }
    return; //とりあえずデバッグ用に追加した。
  } catch(e) {
  	PropertiesService.getScriptProperties().setProperty('ERROR_' + now() + '_' + arguments.callee.name, e.toString());
  }
}

function emailNotify(status) {
	/*
	 * 運行情報をメールで送信する
	 * emailNotify( 運行情報のテキストつまりobj.text/String )
	 * return なし
	 */
	 	try {
		var myMobileMail = PropertiesService.getScriptProperties().getProperty('myMobileMail');
		GmailApp.sendEmail(myMobileMail, '西武鉄道運行情報β', '', {htmlBody: now() + ' 取得<br /><br />' + status});
	} catch(e) {
		PropertiesService.getScriptProperties().setProperty('ERROR_' + now() + '_' + arguments.callee.name, e.toString());
	}
}

function cnvJsonpToJson(jsonp) {
	/*
	 * JSONPで書かれた文字列をJSONに変換する。Objectにパースはしてくれないように変更。
	 * cnvJsonpToJson( JSONP/String )
	 * return Json/String
	 */
  try {
  	var json = jsonp
    //最初に「sr_servicestatus_callback(」があったらカット
    .replace(/(^sr_servicestatus_callback\()?/, '')
    //最初に「sr_emergency_callback(」があったらカット
    .replace(/(^sr_emergency_callback\()?/, '')
    //最後の「)」をカット
    .replace(/\)$/, '');
    return json;
  } catch(e) {
  	var errorKey = 'ERROR_' + now() + '_' + arguments.callee.name;
		return PropertiesService.getScriptProperties().setProperty(errorKey, e.toString());
  }
}

function now() {
	var date = new Date();  // 現在日時を生成
	var MM = date.getMonth() + 1;  // 月を取得（返り値は実際の月-1なので、+1する）
	var dd = date.getDate();  // 日を取得
	var hh = date.getHours();  // 時を取得
	var mm = date.getMinutes();  // 分を取得
	var w = date.getDay();  // 曜日を取得（数値）
	// 月、日、時、分が一桁の場合は先頭に0をつける
	if (MM < 10) {
    MM = "0" + MM;
	}
	if (dd < 10) {
    dd = "0" + dd;
	}
	if (hh < 10) {
    hh = "0" + hh;
	}
	if (mm < 10) {
    mm = "0" + mm;
	}
	// 曜日を数値から文字列に変換するための配列
	var week = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
	// フォーマットを整える
	var result = MM + '/' + dd + '[' + week[w] + '] ' + hh + ':' + mm;
	return result;
}

/*
function getEmergencyStatus() {
	try {
		var obj2 = fetchStatusObj('https://www.seiburailway.jp/api/v1/emergency.jsonp')
		 *
		 *　obj2.chk					：(謎) ex.1
		 *	obj2.items 				：(謎) ex.null
		 *	obj2.published		：(謎 何かの文字列) ex.''
		 *　obj2.status_code	：ステータスコード　ex.200
		 *	obj2.text					：(何か緊急の情報のテキスト？)
		 *	obj2.text_twitter	：(何か緊急の情報のテキストのツイッター用短縮版？)
		 *	obj2.url					：(関連する情報のURL？)								が入るようにする。
		 *
		.Emergency[0];
		return obj2;
	} catch(e) {
		var errorKey = 'ERROR_' + now() + '_' + arguments.callee.name;
		return PropertiesService.getScriptProperties().setProperty(errorKey, e.toString());
	}
}
*/