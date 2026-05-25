let rainData = null;
let regionSelect;
let myMap;       // 存放地圖物件
let markers = []; // 存放地圖上的所有標記

const targetUrl = "https://wic.gov.taipei/OpenData/API/Rain/Get?stationNo=&loginId=open_rain&dataKey=85452C1D";
const proxyUrl = "https://corsproxy.io/?" + encodeURIComponent(targetUrl);

// 擴充座標字典：包含行政區以及 API 常見的觀測站名稱
const stationLocationMap = {
  "台北": [25.0374, 121.5147],
  "大安": [25.0263, 121.5434],
  "士林": [25.0887, 121.5245],
  "北投": [25.1321, 121.4987],
  "內湖": [25.0689, 121.5886],
  "中山": [25.0685, 121.5281],
  "大同": [25.0645, 121.5133],
  "松山": [25.0598, 121.5583],
  "萬華": [25.0336, 121.4988],
  "中正": [25.0324, 121.5190],
  "信義": [25.0324, 121.5674],
  "南港": [25.0547, 121.6068],
  "文山": [24.9880, 121.5750],
  "陽明山": [25.1557, 121.5484],
  "竹子湖": [25.1631, 121.5367],
  "溪山": [25.1154, 121.5762],
  "鞍部": [25.1834, 121.5295],
  "公館": [25.0132, 121.5365],
  "天母": [25.1171, 121.5276],
  "石牌": [25.1147, 121.5161],
  "古亭": [25.0223, 121.5218],
  "大直": [25.0823, 121.5436],
  "社子": [25.0970, 121.5031],
  "至善": [25.1051, 121.5611],
  "貴子坑": [25.1511, 121.4901],
  "桃源": [25.1371, 121.4881],
  "平等": [25.1351, 121.5791],
  "菁山": [25.1451, 121.5751],
  "馬槽": [25.1751, 121.5701],
  "五常": [25.0641, 121.5401],
  "舊莊": [25.0381, 121.6201],
  "大理": [25.0311, 121.4951],
  "華江": [25.0361, 121.4861],
  "老松": [25.0371, 121.5021],
  "福德": [25.0361, 121.5861]
};

function setup() {
  noCanvas(); // 這次我們不需要 p5 的畫布，因為畫面都被 Leaflet 地圖包辦了！

  // --- 1. 初始化 Leaflet 地圖 ---
  // 設定初始中心點在台北市中心，縮放等級為 12
  myMap = L.map('map').setView([25.05, 121.53], 12);
  
  // 載入 OpenStreetMap 的圖資
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(myMap);

  // --- 2. 使用 p5.js 建立下拉選單 UI ---
  regionSelect = createSelect();
  regionSelect.position(20, 20);
  regionSelect.class('p5-ui'); // 套用 HTML 裡的 CSS 設定，確保它浮在地圖上方
  regionSelect.style('font-size', '18px');
  regionSelect.style('padding', '8px');
  regionSelect.style('border-radius', '8px');
  regionSelect.style('box-shadow', '0 4px 6px rgba(0,0,0,0.3)');
  regionSelect.option('資料載入中...');
  
  // 當選單改變時，觸發移動地圖的函式
  regionSelect.changed(goToRegion);

  // --- 3. 抓取 API 資料 ---
  fetch(proxyUrl)
    .then(response => response.json())
    .then(data => {
      rainData = Array.isArray(data) ? data : (data.data || data.list || []);
      setupMapData(); // 資料抓到後，更新選單與地圖標籤
    })
    .catch(error => {
      console.error("API 載入失敗", error);
      regionSelect.elt.innerHTML = ''; 
      regionSelect.option('資料載入失敗，請檢查網路或 Proxy');
    });
}

// 處理資料並放到地圖上
function setupMapData() {
  regionSelect.elt.innerHTML = ''; 
  regionSelect.option('顯示全台北市 (總覽)');
  
  // 將主要行政區加入選單
  let districts = ["北投", "士林", "內湖", "中山", "大同", "松山", "南港", "中正", "萬華", "大安", "信義", "文山"];
  for (let i = 0; i < districts.length; i++) {
    regionSelect.option(districts[i] + "區");
  }

  // 走訪每一筆測站資料，在地圖上打點
  rainData.forEach(station => {
    let stName = station.stationName || station.StationName || "未知測站";
    
    // 尋找雨量欄位 (容錯處理)
    let rain10m = station.rain10 ?? station.rain10mins ?? station.Rain10mins ?? station.m10 ?? 0;
    let rain1h = station.rain1H ?? station.rain1hr ?? station.Rain1hr ?? station.h1 ?? 0;
    let rainNow = station.rain ?? 0; // 有些 API 只有一個 rain 欄位

    // 判斷該測站大概屬於哪個區域來決定座標
    let lat = station.lat || station.latitude || station.Lat;
    let lon = station.lon || station.longitude || station.Lon;

    if (!lat || !lon) {
      for (let key in stationLocationMap) {
        if (stName.includes(key)) {
          // 為了避免同區的標記疊在一起，給座標加一點隨機小偏移
          lat = stationLocationMap[key][0] + random(-0.01, 0.01);
          lon = stationLocationMap[key][1] + random(-0.01, 0.01);
          break;
        }
      }
    }

    // 如果有座標，就在地圖上加入標記
    if (lat && lon) {
      let marker = L.marker([lat, lon]).addTo(myMap);
      
      // 如果 rainNow 有值但 1h 為 0，則顯示 rainNow
      let displayRain = rain1h > 0 ? rain1h : rainNow;

      // 點擊標記時會跳出小視窗顯示雨量
      marker.bindPopup(`
        <b style="font-size:16px;">📍 ${stName}</b><br>
        即時雨量: <b>${displayRain}</b> mm<br>
        <small>更新時間: ${station.datetime || '未知'}</small>
      `);
      markers.push(marker);
    }
  });

  // --- 4. 自動調整地圖視野以包含所有標記 ---
  if (markers.length > 0) {
    let group = new L.featureGroup(markers);
    myMap.fitBounds(group.getBounds(), { padding: [20, 20] });
  }
}

// 處理選單點擊後的地圖移動
function goToRegion() {
  let selected = regionSelect.value();
  
  if (selected === '顯示全台北市 (總覽)') {
    // 飛回預設視角
    myMap.flyTo([25.05, 121.53], 12, { duration: 1.5 });
  } else {
    // 把 "區" 字拿掉，例如 "士林區" -> "士林"
    let keyword = selected.replace("區", "");
    
    // 如果在字典裡找不到，就預設飛往市中心
    let coords = stationLocationMap[keyword] || [25.05, 121.53];
    
    if (coords) {
      let targetLat = coords[0];
      let targetLon = coords[1];
      
      myMap.flyTo([targetLat, targetLon], 14, {
        duration: 1.5 
      });
    }
  }
}