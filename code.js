function forwardTransitInfo2() {
  try {

    var obj = getServiceStatus();
    var timeProperty = PropertiesService.getScriptProperties().getProperty('obj.time');
    //もし最終更新時刻が変わってなかったら終了。もし変わってたらjsonを記録して、メールを送信する。
    if (obj.time == timeProperty) {
    	return;
    } else {
    	PropertiesService.getScriptProperties().setProperty('obj.time', obj.time);
    	//とりあえず改めて取得しなおした。
    	var jsonp = UrlFetchApp.fetch('https://www.seiburailway.jp/api/v1/servicestatus.jsonp')
    	.getContentText('UTF-8');
    	var json = jsonp
    	//最初に「sr_servicestatus_callback(」があったらカット
    	.replace(/(^sr_servicestatus_callback\()?/, '')
    	//最初に「sr_emergency_callback(」があったらカット
   		.replace(/(^sr_emergency_callback\()?/, '')
    	//最後の「)」をカット
  		.replace(/\)$/, '');
    	var myMobileMail = PropertiesService.getScriptProperties().getProperty('mymobileMail');
    	GmailApp.sendEmail(myMobileMail, '西武鉄道運行情報β', '', {htmlBody:now() + '<br /><br />' + obj.text})
    	PropertiesService.getScriptProperties().setProperty('TEXT_' + now(), json);
    }
    return; //とりあえずデバッグ用に追加した。
  } catch(e) {
  	PropertiesService.getScriptProperties().setProperty('ERROR_' + now(), e.toString());
  }
}

function now() {
	var date = new Date();         // 現在日時を生成
	var mm = date.getMonth() + 1;  // 月を取得（返り値は実際の月-1なので、+1する）
	var dd = date.getDate(); // 日を取得
	var w = date.getDay();   // 曜日を取得（数値）
	var hh = date.getHours();
	var mi = date.getMinutes();
	 
	// 月と日が一桁の場合は先頭に0をつける
	if (mm < 10) {
    mm = "0" + mm;
	}
	if (dd < 10) {
    dd = "0" + dd;
	}
	if (hh < 10) {
    hh = "0" + hh;
	}
	if (mi < 10) {
    mi = "0" + mi;
	}
 
	// 曜日を数値から文字列に変換するための配列
	var week = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
	// フォーマットを整えて表示
	var result = mm + '/' + dd + '[' + week[w] + '] ' + hh + ':' + mi + ' 取得';
	return result;
}

function getServiceStatus() {
	try {
		var obj = fetchStatusObj('https://www.seiburailway.jp/api/v1/servicestatus.jsonp')
		/*
		 *　obj.chk					：(謎) ex.0
		 *	obj.status_code ：ステータスコード　ex.200
		 *	obj.text 				：運行情報のテキスト
		 *　obj.time				：最終更新日時
		 *	obj.tif[].pif[]	：(振替輸送？)
		 *	obj.tif_all			：(振替輸送全区間？)
		 *	obj.time				：最終更新日時								が入るようにする。
		 */
		.IDS2Web[0];
		return obj;
	} catch(e) {
		var errKey = 'ERROR_' + now() + '_' + arguments.callee.name;
		return PropertiesService.getScriptProperties().setProperty(errKey, e.toString());
	}
}

function getEmergencyStatus() {
	try {
		var obj2 = fetchStatusObj('https://www.seiburailway.jp/api/v1/emergency.jsonp')
		/*
		 *　obj2.chk					：(謎) ex.1
		 *	obj2.items 				：(謎) ex.null
		 *	obj2.published		：(謎 何かの文字列) ex.''
		 *　obj2.status_code	：ステータスコード　ex.200
		 *	obj2.text					：(何か緊急の情報のテキスト？)
		 *	obj2.text_twitter	：(何か緊急の情報のテキストのツイッター用短縮版？)
		 *	obj2.url					：(関連する情報のURL？)								が入るようにする。
		 */
		.Emergency[0];
		return obj2;
	} catch(e) {
		var errKey = 'ERROR_' + now() + '_' + arguments.callee.name;
		return PropertiesService.getScriptProperties().setProperty(errKey, e.toString());
	}
}

function fetchStatusObj(url) {
	/* 
	 * 引数に指定されたJSONPのURLを取得し、パースしたうえでそのオブジェクトを返します。
	 * fetchStatusObj( 取得したいホームページのURL/String )
	 * return parseJsonp(jsonp) によってパースされたもの/Object
	 */
  try {
  	// 因数のURLをurlValidator(url)でURLだと確認する。
    if (!urlValidator(url)) throw new Error('Invalid args');
    var res = UrlFetchApp.fetch(url);
    if (res.getResponseCode() !== 200) throw new Error('Not Found');
    var jsonp  = res.getContentText('UTF-8');
		obj = parseJsonp(jsonp);
	return obj;
  } catch(e) {
    var errKey = 'ERROR_' + now() + '_' + arguments.callee.name;
		return PropertiesService.getScriptProperties().setProperty(errKey, e.toString());
  }
}

function parseJsonp(jsonp) {
	/*
	 * JSONPで書かれた文字列をJSONに変換したうえで、Objectにパースする。
	 * parseJsonp( JSONP/String )
	 * return パース後/Object
	 */
  try {
  	var json = jsonp
    //最初に「sr_servicestatus_callback(」があったらカット
    .replace(/(^sr_servicestatus_callback\()?/, '')
    //最初に「sr_emergency_callback(」があったらカット
    .replace(/(^sr_emergency_callback\()?/, '')
    //最後の「)」をカット
    .replace(/\)$/, '');
    var obj = JSON.parse(json);
    return obj;
  } catch(e) {
  	var errKey = 'ERROR_' + now() + '_' + arguments.callee.name;
		return PropertiesService.getScriptProperties().setProperty(errKey, e.toString());
  }
}

function urlValidator(str) {
	/* 引数に指定された文字列がURLであったらTrueを返します。
	 * str/String
	 * return strがURLかどうか/Booleen
	 */
  var regexp = /^(https?|ftp)(:\/\/[-_.!~*\'()a-zA-Z0-9;\/?:\@&=+\$,%#]+)$/;
  return (typeof str == 'string' && regexp.test(str));
}