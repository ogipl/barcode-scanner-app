// バーコードスキャンで取得した値を格納する変数
let barcode1 = null; // 1つ目のバーコード
let barcode2 = null; // 2つ目のバーコード

// HTML要素への参照を取得
const barcode1Display = document.getElementById('barcode1-display');
const barcode2Display = document.getElementById('barcode2-display');
const resultDisplay = document.getElementById('result-display');
const cameraFeed = document.getElementById('camera-feed');

// 連続スキャン防止のための変数
let lastDetectedCode = null;
let lastDetectionTime = 0;

// QuaggaJS の初期設定とカメラの起動
function startScanner() {
    // 既にスキャナーが起動している場合は一度停止する
    if (Quagga.initialized) {
        Quagga.stop();
    }

Quagga.init({
    inputStream: {
        name: "Live",
        type: "LiveStream",
        target: cameraFeed, // HTMLのvideo要素を指定

    },
    decoder: {
        readers: ["code_39_reader"], // CODE39 を読み取る設定
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
        console.error("QuaggaJS 初期化エラー:", err);
        resultDisplay.textContent = "カメラの起動に失敗しました。ブラウザの設定や他のアプリがカメラを使用していないか確認してください。";
        resultDisplay.style.color = "red";
        alert("カメラの起動に失敗しました。ブラウザの設定や他のアプリがカメラを使用していないか確認してください。");
        return;
    }
    console.log("QuaggaJS 初期化成功。スキャンを開始します。");
    resultDisplay.textContent = "最初のバーコードをスキャンしてください";
    resultDisplay.style.color = "blue";
    Quagga.start();
});

    // バーコードが検出された時の処理
    Quagga.onDetected(function(result) {
        // 同じバーコードを連続で読み込まないように、短い時間で重複を避ける
        if (result.codeResult.code === lastDetectedCode && (new Date().getTime() - lastDetectionTime < 1000)) {
            return; // 1秒以内に同じコードが検出されたら無視
        }

        const code = result.codeResult.code; // 検出されたバーコードの値

        console.log("バーコード検出:", code);

        // 最初のバーコードがまだスキャンされていない場合
        if (barcode1 === null) {
            barcode1 = code;
            barcode1Display.textContent = code;
            barcode2Display.textContent = "まだスキャンしていません";
            resultDisplay.textContent = "2つ目のバーコードをスキャンしてください";
            resultDisplay.style.color = "orange";
        }
        // 2つ目のバーコードがスキャンされた場合
        else {
            barcode2 = code;
            barcode2Display.textContent = code;

            // 2つのバーコードを比較
            if (barcode1 === barcode2) {
                resultDisplay.textContent = "OK！一致しました！";
                resultDisplay.style.color = "green";
                // 比較後、次のスキャンのために値をリセット
                barcode1 = null;
                barcode2 = null;
            } else {
                resultDisplay.textContent = "NG！一致しません！";
                resultDisplay.style.color = "red";
                // 不一致の場合も次のスキャンのために値をリセット
                barcode1 = null;
                barcode2 = null;
            }
        }

        // 連続スキャンを防ぐための設定を更新
        lastDetectedCode = code;
        lastDetectionTime = new Date().getTime();
    });

    // スキャンエラー時の処理（バーコードのハイライト表示）
    Quagga.onProcessed(function(result) {
        const drawingCtx = Quagga.canvas.ctx.overlay;
        const drawingCanvas = Quagga.canvas.dom.overlay;

        if (result) {
            if (result.boxes) {
                drawingCtx.clearRect(0, 0, parseInt(drawingCanvas.width), parseInt(drawingCanvas.height));
                result.boxes.filter(function (box) {
                    return box !== result.box;
                }).forEach(function (box) {
                    Quagga.ImageDebug.drawPath(box, {x: 0, y: 1}, drawingCtx, {color: "green", lineWidth: 2});
                });
            }

            if (result.box) {
                Quagga.ImageDebug.drawPath(result.box, {x: 0, y: 1}, drawingCtx, {color: "#00F", lineWidth: 2});
            }

            if (result.codeResult && result.codeResult.code) {
                Quagga.ImageDebug.drawPath(result.line, {x: 'x', y: 'y'}, drawingCtx, {color: 'red', lineWidth: 3});
            }
        }
    });
}

// ページ読み込みが完了したらスキャナーを起動
window.addEventListener('load', startScanner);

// 画面サイズ変更時などにスキャナーをリセットする（任意）
// これにより、画面の向きを変えた時などにカメラ映像が適切に調整されます。
window.addEventListener('resize', function() {
    if (Quagga.initialized) {
        Quagga.stop();
    }
    // 少し遅延させてから起動しないと、resizeイベントが連続で発火しすぎることがある
    setTimeout(startScanner, 500);
});