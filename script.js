// script.js

// HTML要素への参照を取得
const cameraFeed = document.getElementById('camera-feed');
const resultDisplay = document.getElementById('result');
const debugInfoDisplay = document.getElementById('debug-info'); // 新しく追加したデバッグ情報表示用の要素

// デバッグ情報を表示するためのヘルパー関数
function updateDebugInfo(message, color = 'grey') {
    debugInfoDisplay.textContent = `Debug: ${new Date().toLocaleTimeString()} - ${message}`;
    debugInfoDisplay.style.color = color;
    console.log(`[DEBUG] ${message}`); // コンソールにも出力
}

// =======================================================
// Video要素に関するイベントリスナー
// カメラ映像のロード状況や再生状態を詳細に把握するために追加
// =======================================================

// ビデオのメタデータ（幅、高さなど）が読み込まれたときに発火
cameraFeed.addEventListener('loadedmetadata', () => {
    const videoWidth = cameraFeed.videoWidth;
    const videoHeight = cameraFeed.videoHeight;
    updateDebugInfo(`Video metadata loaded: ${videoWidth}x${videoHeight}`, 'blue');
    resultDisplay.textContent = `カメラ映像メタデータ読み込み完了: ${videoWidth}x${videoHeight}`;
    resultDisplay.style.color = "green";

    // ビデオ要素が再生可能かチェック
    if (cameraFeed.readyState >= cameraFeed.HAVE_CURRENT_DATA) {
        updateDebugInfo('Video is ready to play state (HAVE_CURRENT_DATA).', 'blue');
        // 実際に映像が表示されるか確認するため、強制的に再生を試みる
        cameraFeed.play().then(() => {
            updateDebugInfo('Video play() command successful.', 'green');
        }).catch(e => {
            // 自動再生がブロックされた場合などに発生
            updateDebugInfo(`Video auto-play failed: ${e.name} - ${e.message}`, 'red');
            resultDisplay.textContent = `自動再生失敗: ${e.name} - ${e.message}`;
            resultDisplay.style.color = "red";
        });
    } else {
        updateDebugInfo(`Video readyState: ${cameraFeed.readyState}`, 'orange');
    }
});

// ビデオ要素でエラーが発生した場合
cameraFeed.addEventListener('error', (e) => {
    updateDebugInfo(`Video element error: ${e.name || e.message || e.toString()}`, 'red');
    resultDisplay.textContent = `ビデオ要素エラー: ${e.name || e.message || e.toString()}`;
    resultDisplay.style.color = "red";
    // 詳細なエラーオブジェクトを出力してデバッグに役立てる
    console.error("Full video element error object:", e);
});

// ビデオが実際に再生を開始したときに発火
cameraFeed.addEventListener('playing', () => {
    updateDebugInfo('Video is actually playing!', 'green');
    resultDisplay.textContent = "カメラ映像が再生中！";
    resultDisplay.style.color = "green";
});

// ビデオが一時停止したときに発火 (デバッグ用)
cameraFeed.addEventListener('pause', () => {
    updateDebugInfo('Video paused.', 'orange');
});

// ビデオが停止したときに発火 (デバッグ用)
cameraFeed.addEventListener('ended', () => {
    updateDebugInfo('Video ended.', 'orange');
});

// =======================================================
// QuaggaJSの初期化と設定
// =======================================================

Quagga.init({
    inputStream: {
        name: "Live",
        type: "LiveStream",
        target: cameraFeed, // HTMLのvideo要素を指定
        constraints: { // ★ここを追加★
            width: { min: 480, ideal: 640, max: 1280 }, // 解像度の幅
            height: { min: 320, ideal: 480, max: 720 }, // 解像度の高さ
            facingMode: "environment" // 背面カメラを優先 (iPhoneの場合)
        },
    },
    decoder: {
        readers: ["code_39_reader"],
        debug: {
            showCanvas: false,
            showPatches: false,
            showFoundPatches: false,
            showSkeleton: false,
            showLabels: false,
            showPatchLabels: false,
            showRemainingPatchLabels: false,
            boxFromPatches: {
                showTransformed: false,
                showTransformedBox: false,
                showBB: false
            }
        }
    },
    locate: true
}, function(err) {
    if (err) {
        // QuaggaJS初期化時のエラーハンドリング
        updateDebugInfo(`QuaggaJS Init Error: ${err.name || err.message || err.toString()}`, 'red');
        console.error("QuaggaJS 初期化エラー詳細:", err);

        let errorMessage = "カメラの起動に失敗しました。";
        if (err.name === 'NotAllowedError') {
            errorMessage += " カメラへのアクセスが拒否されました。ブラウザの許可設定を確認してください。";
        } else if (err.name === 'NotFoundError') {
            errorMessage += " カメラが見つかりませんでした。接続を確認してください。";
        } else if (err.name === 'NotReadableError') {
            errorMessage += " カメラが使用中です。他のアプリやタブを閉じてください。";
        } else if (err.name === 'OverconstrainedError') {
            errorMessage += " カメラ設定（解像度など）がデバイスでサポートされていません。";
        } else if (err.name === 'AbortError') {
            errorMessage += " カメラアクセスが中断されました。";
        } else {
            errorMessage += ` エラーコード: ${err.name || err.message || '不明'}`;
        }
        resultDisplay.textContent = errorMessage;
        resultDisplay.style.color = "red";
        alert(errorMessage); // アラートも表示して、ユーザーに分かりやすくする
        return;
    }
    updateDebugInfo("QuaggaJS Initialization successful. Starting scan.", 'green');
    resultDisplay.textContent = "最初のバーコードをスキャンしてください";
    resultDisplay.style.color = "blue";
    Quagga.start();
});

// =======================================================
// バーコード検出時のイベントハンドラ
// =======================================================

Quagga.onDetected(function(result) {
    const code = result.codeResult.code;
    if (code) { // コードが検出された場合のみ表示
        resultDisplay.textContent = `スキャン結果: ${code}`;
        resultDisplay.style.color = "green";
        updateDebugInfo(`Barcode detected: ${code}`, 'green');
        console.log("Barcode detected:", code);

        // 必要に応じて、スキャン後にQuaggaを一時停止し、重複スキャンを防ぐ
        // Quagga.stop();
        // setTimeout(() => Quagga.start(), 2000); // 2秒後にスキャン再開
    } else {
        updateDebugInfo('No barcode code in result.', 'orange');
    }
});

// =======================================================
// 映像処理時のイベントハンドラ (デバッグ描画用)
// =======================================================

Quagga.onProcessed(function(result) {
    // 描画用のCanvasコンテキストを取得
    const drawingCtx = Quagga.canvas.ctx.overlay;
    const drawingCanvas = Quagga.canvas.dom.overlay;

    // 前回の描画をクリア
    drawingCtx.clearRect(0, 0, parseInt(drawingCanvas.getAttribute("width")), parseInt(drawingCanvas.getAttribute("height")));

    if (result) {
        // 検出された全てのボックスを描画 (メインのボックス以外)
        if (result.boxes) {
            result.boxes.filter(function (box) {
                return box !== result.box;
            }).forEach(function (box) {
                Quagga.ImageDebug.drawPath(box, {x: 0, y: 1}, drawingCtx, {color: "green", lineWidth: 2});
            });
        }

        // メインのバーコードのボックスを描画
        if (result.box) {
            Quagga.ImageDebug.drawPath(result.box, {x: 0, y: 1}, drawingCtx, {color: "#00F", lineWidth: 2});
        }

        // 検出されたバーコードの線を描画
        if (result.codeResult && result.codeResult.code) {
            Quagga.ImageDebug.drawPath(result.line, {x: 'x', y: 'y'}, drawingCtx, {color: "red", lineWidth: 3});
        }
    }
});