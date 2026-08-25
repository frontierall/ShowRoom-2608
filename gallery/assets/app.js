/* ============================================================
   assets/app.js  -  갤러리 화면을 그리고 조작하는 코드

   [전체 흐름]
   1) window.GALLERY_DATA (data/examples.js) 에서 데이터를 읽는다
   2) state 라는 객체 하나에 "지금 화면 상태"를 모아둔다
   3) 상태가 바뀌면 render() 를 다시 불러 화면을 통째로 다시 그린다

   상태를 한 곳에 모으고 "상태 -> 화면" 방향으로만 그리는 방식은
   React 같은 프레임워크가 쓰는 사고방식과 같습니다.
   여기서는 프레임워크 없이 손으로 그 구조를 따라 해 봅니다.

   전체를 즉시실행함수 (function(){ ... })(); 로 감싼 이유는
   여기서 만든 변수들이 전역(window)을 더럽히지 않게 하기 위함입니다.
   ============================================================ */

(function () {
  'use strict';

  /* ----------------------------------------------------------
     0. 짧은 도우미 함수들
     ---------------------------------------------------------- */

  // document.querySelector 를 짧게 쓰기 위한 별칭
  function $(selector) {
    return document.querySelector(selector);
  }

  // HTML 특수문자를 안전한 문자로 바꿉니다.
  // 데이터에 < > 같은 글자가 들어와도 태그로 해석되지 않게 하는 기본 보안 처리입니다.
  function esc(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ----------------------------------------------------------
     1. 데이터 + 상태
     ---------------------------------------------------------- */

  var DATA = window.GALLERY_DATA || { galleries: [] };

  // 예제가 하나라도 있는 첫 번째 갤러리를 기본 선택으로 잡습니다.
  var firstFilled = DATA.galleries.filter(function (g) {
    return g.items && g.items.length > 0;
  })[0];

  var state = {
    galleryId: firstFilled ? firstFilled.id : (DATA.galleries[0] || {}).id,
    group: 'all',       // 'all' 이면 분류 필터 없음
    itemId: null,       // 모달에 열려 있는 예제 id (null 이면 모달 닫힘)
    width: 'desktop'    // 모달 미리보기 폭: desktop / tablet / mobile
  };

  // 자주 쓰는 DOM 요소를 미리 찾아둡니다. (매번 찾으면 낭비)
  var elTabs      = $('#galleryTabs');
  var elFilters   = $('#groupFilters');
  var elGrid      = $('#cardGrid');
  var elStatus    = $('#resultStatus');
  var elEmpty     = $('#emptyState');

  var elModal     = $('#modal');
  var elModalTitle= $('#modalTitle');
  var elWidthSw   = $('#widthSwitch');
  var elOpenNew   = $('#modalOpenNew');
  var elPreview   = $('#previewFrame');
  var elPreviewUrl= $('#previewUrl');
  var elIframe    = $('#previewIframe');
  var elWhen      = $('#noteWhen');
  var elPros      = $('#notePros');
  var elCons      = $('#noteCons');

  // 모달을 닫았을 때 원래 눌렀던 카드로 초점을 되돌리기 위해 기억해 둡니다.
  var lastFocused = null;

  /* ----------------------------------------------------------
     2. 데이터 조회 도우미
     ---------------------------------------------------------- */

  // 지금 선택된 갤러리 객체
  function currentGallery() {
    var found = DATA.galleries.filter(function (g) {
      return g.id === state.galleryId;
    })[0];
    return found || { id: '', title: '', groups: [], items: [] };
  }

  // 지금 선택된 분류 필터를 적용한 예제 목록
  function visibleItems() {
    var items = currentGallery().items || [];
    if (state.group === 'all') return items;
    return items.filter(function (item) {
      return item.group === state.group;
    });
  }

  // 모달에 열려 있는 예제 객체
  function currentItem() {
    return (currentGallery().items || []).filter(function (item) {
      return item.id === state.itemId;
    })[0];
  }

  /* ----------------------------------------------------------
     3. [1층] 상단 가로 탭 그리기
     ---------------------------------------------------------- */
  function renderTabs() {
    var html = DATA.galleries.map(function (g) {
      var count    = (g.items || []).length;
      var isEmpty  = count === 0;                 // 예제가 없으면 비활성
      var isActive = g.id === state.galleryId;

      return ''
        + '<button type="button" class="tab' + (isActive ? ' is-active' : '') + '"'
        +   ' data-gallery="' + esc(g.id) + '"'
        +   (isEmpty ? ' disabled title="준비 중인 갤러리입니다"' : '') + '>'
        +   esc(g.title)
        +   '<span class="tab__badge">' + (isEmpty ? '준비 중' : count) + '</span>'
        + '</button>';
    }).join('');

    elTabs.innerHTML = html;
  }

  /* ----------------------------------------------------------
     4. [2층] 분류 필터 그리기
     "전체" + groups 항목.
     선택된 항목에는 체크 표시가 켜져서 "필터"임이 드러납니다.
     ---------------------------------------------------------- */
  function renderFilters() {
    var gallery = currentGallery();
    var items   = gallery.items || [];

    // 맨 앞에 "전체"를 직접 끼워 넣습니다.
    var rows = [{ id: 'all', label: '전체' }].concat(gallery.groups || []);

    elFilters.innerHTML = rows.map(function (row) {
      // 각 분류에 몇 개가 들어 있는지 세어 옆에 표시합니다.
      var count = row.id === 'all'
        ? items.length
        : items.filter(function (it) { return it.group === row.id; }).length;

      var isOn = row.id === state.group;

      return ''
        + '<li>'
        +   '<button type="button" class="filter' + (isOn ? ' is-on' : '') + '"'
        +     ' data-group="' + esc(row.id) + '"'
        +     ' aria-pressed="' + (isOn ? 'true' : 'false') + '">'
        +     '<span class="filter__check" aria-hidden="true">✓</span>'
        +     '<span>' + esc(row.label) + '</span>'
        +     '<span class="filter__count">' + count + '</span>'
        +   '</button>'
        + '</li>';
    }).join('');
  }

  /* ----------------------------------------------------------
     5. [3층] 카드 그리드 그리기
     썸네일은 그림이 아니라 진짜 iframe 을 축소한 "라이브 미리보기"입니다.
     ---------------------------------------------------------- */
  function renderGrid() {
    var items = visibleItems();

    // 예제가 아예 없는 갤러리면 빈 상태 안내를 대신 보여줍니다.
    var galleryIsEmpty = (currentGallery().items || []).length === 0;
    elEmpty.hidden = !galleryIsEmpty;
    elGrid.hidden  = galleryIsEmpty;

    // 현재 필터 상태를 한 줄로 안내
    if (galleryIsEmpty) {
      elStatus.textContent = '';
    } else {
      var groupRow = (currentGallery().groups || []).filter(function (g) {
        return g.id === state.group;
      })[0];
      var label = groupRow ? groupRow.label : '전체';
      elStatus.textContent = '분류: ' + label + ' · ' + items.length + '개 예제';
    }

    elGrid.innerHTML = items.map(function (item) {
      // 모바일용 예제는 좁은 폭으로 미리보기를 잡아야 제 모습이 나옵니다.
      var isMobile = item.bestWidth === 'mobile';

      return ''
        + '<button type="button" class="card" data-item="' + esc(item.id) + '">'
        +   '<div class="thumb' + (isMobile ? ' thumb--mobile' : '') + '">'
        +     '<div class="thumb__scaler' + (isMobile ? ' thumb__scaler--mobile' : '') + '">'
        // loading="lazy" : 화면에 보일 때가 되어서야 불러옵니다(초기 로딩 절약)
        // scrolling="no"  : 썸네일 안에서는 스크롤바가 보이지 않게
        // tabindex="-1"   : iframe 이 키보드 초점을 가로채지 않게
        +       '<iframe src="' + esc(item.file) + '" loading="lazy"'
        +         ' scrolling="no" tabindex="-1" aria-hidden="true"'
        +         ' title="' + esc(item.title) + ' 미리보기"></iframe>'
        +     '</div>'
        +   '</div>'
        +   '<div class="card__body">'
        +     '<h3 class="card__title">' + esc(item.title) + '</h3>'
        +     '<p class="card__summary">' + esc(item.summary) + '</p>'
        +   '</div>'
        + '</button>';
    }).join('');
  }

  /* ----------------------------------------------------------
     6. 모달(상세 오버레이)
     ---------------------------------------------------------- */

  // 세그먼티드 컨트롤의 선택 표시와 미리보기 프레임의 폭을 함께 갱신합니다.
  function applyWidth() {
    // (1) 버튼 선택 표시
    var buttons = elWidthSw.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      var on = buttons[i].getAttribute('data-width') === state.width;
      buttons[i].classList.toggle('is-on', on);
      buttons[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }

    // (2) 브라우저 창 프레임의 폭 클래스 교체.
    //     바뀌는 것은 폭뿐이고, 예제 자체는 그대로 살아 있습니다.
    //     폭이 줄면 예제 안의 미디어쿼리가 진짜로 반응합니다.
    elPreview.className = 'browser browser--' + state.width;
  }

  function openModal(itemId) {
    state.itemId = itemId;

    var item = currentItem();
    if (!item) return;

    // 닫을 때 초점을 되돌리기 위해 지금 눌린 요소를 기억
    lastFocused = document.activeElement;

    // 제목 / 링크 / 주소 표시줄
    elModalTitle.textContent = item.title;
    elOpenNew.href = item.file;
    elPreviewUrl.textContent = item.file;

    // 예제에 어울리는 폭으로 시작 (모바일 예제면 모바일 폭부터)
    state.width = item.bestWidth === 'mobile' ? 'mobile' : 'desktop';
    applyWidth();

    // 미리보기 로드. src 를 이때 넣어야 모달을 열 때 비로소 실행됩니다.
    elIframe.src = item.file;

    // 설명 패널 채우기
    elWhen.textContent = item.when || '';
    elPros.innerHTML = (item.pros || []).map(function (t) {
      return '<li>' + esc(t) + '</li>';
    }).join('');
    elCons.innerHTML = (item.cons || []).map(function (t) {
      return '<li>' + esc(t) + '</li>';
    }).join('');

    // 열기 + 뒤쪽 스크롤 잠금
    elModal.hidden = false;
    document.body.classList.add('is-locked');

    // 닫기 버튼으로 초점을 옮겨 키보드 사용자가 바로 조작할 수 있게
    $('#modalClose').focus();
  }

  function closeModal() {
    if (elModal.hidden) return;

    elModal.hidden = true;
    document.body.classList.remove('is-locked');

    // iframe 을 비워 예제 안의 스크립트/애니메이션을 확실히 멈춥니다.
    elIframe.src = 'about:blank';

    state.itemId = null;

    // 원래 눌렀던 카드로 초점 복귀
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  /* ----------------------------------------------------------
     7. 전체 다시 그리기
     ---------------------------------------------------------- */
  function render() {
    renderTabs();
    renderFilters();
    renderGrid();
  }

  /* ----------------------------------------------------------
     8. 이벤트 연결

     카드/버튼마다 따로 이벤트를 붙이지 않고,
     부모 요소에 한 번만 붙여서 클릭이 "올라오는" 것을 받는 방식입니다.
     (이벤트 위임 / event delegation)
     다시 그려서 버튼이 새로 만들어져도 이벤트를 다시 붙일 필요가 없습니다.
     ---------------------------------------------------------- */

  // (1) 상단 갤러리 탭
  elTabs.addEventListener('click', function (e) {
    var btn = e.target.closest('.tab');
    if (!btn || btn.disabled) return;

    state.galleryId = btn.getAttribute('data-gallery');
    state.group = 'all';          // 갤러리를 바꾸면 필터는 초기화
    render();
  });

  // (2) 분류 필터
  elFilters.addEventListener('click', function (e) {
    var btn = e.target.closest('.filter');
    if (!btn) return;

    state.group = btn.getAttribute('data-group');
    renderFilters();              // 필터 표시 갱신
    renderGrid();                 // 카드 목록 갱신
  });

  // (3) 카드 클릭 -> 모달 열기 (카드 전체가 클릭 영역)
  elGrid.addEventListener('click', function (e) {
    var card = e.target.closest('.card');
    if (!card) return;
    openModal(card.getAttribute('data-item'));
  });

  // (4) 폭 전환 세그먼티드 컨트롤
  elWidthSw.addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    state.width = btn.getAttribute('data-width');
    applyWidth();
  });

  // (5) 닫기 버튼
  $('#modalClose').addEventListener('click', closeModal);

  // (6) 배경(딤) 클릭으로 닫기.
  //     index.html 에서 배경에 data-close="1" 을 달아 두었습니다.
  elModal.addEventListener('click', function (e) {
    if (e.target.getAttribute('data-close') === '1') closeModal();
  });

  // (7) ESC 키로 닫기
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });

  /* ----------------------------------------------------------
     9. 시작
     ---------------------------------------------------------- */
  render();
})();
