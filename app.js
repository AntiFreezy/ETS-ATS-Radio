/**
 * ETS 2 / ATS Radio Station Helper - Main Application Logic
 * Version: 2.7.1 (Removed Persistent Selection + Visual Improvements)
 */
document.addEventListener('DOMContentLoaded', () => {

	// --- Глобальные переменные и константы ---
	const API_BASE_URL = 'https://{endpoint}.api.radio-browser.info/json';
	const API_ENDPOINTS = ['de1', 'de2', 'fi1', 'all'];
	let currentApiEndpoint = API_ENDPOINTS[0];
	let activeApiUrl = API_BASE_URL.replace('{endpoint}', currentApiEndpoint);
	const FETCH_TIMEOUT = 15000; // 15 seconds
	let searchDebounceTimer = null;
	const SEARCH_DEBOUNCE_DELAY = 300; // ms
	const ITEMS_PER_PAGE = 50;

	// Элементы DOM
	const countrySelectElement = document.getElementById('country-select');
	const searchInput = document.getElementById('search-input');
	const genreSelectElement = document.getElementById('genre-select');
	const tableContainer = document.getElementById('table-container');
	const selectionCountElement = document.getElementById('selection-count');
	const downloadCountElement = document.getElementById('download-count');
	const selectVisibleBtn = document.getElementById('select-visible');
	const deselectVisibleBtn = document.getElementById('deselect-visible');
	const selectAllFilteredBtn = document.getElementById('select-all-filtered');
	const deselectAllFilteredBtn = document.getElementById('deselect-all-filtered');
	const downloadBtn = document.getElementById('download-selected');
	const volumeControl = document.getElementById('volume-control');
	const stopPlaybackBtn = document.getElementById('stop-all-playback');
	const audioPlayer = document.getElementById('audio-player');
	const loadingOverlay = document.getElementById('loading-overlay');
	const loadingTextElement = document.getElementById('loading-text');
	const translateDiv = document.getElementById('translate');
	const controlsDiv = document.getElementById('controls');
	const paginationContainer = document.getElementById('pagination-container');
	const toastContainer = document.querySelector('.toast-container');

	// Состояние приложения
	let tomSelectCountries = null;
	let tomSelectGenres = null;
	let allStations = [];
	let filteredStations = []; // Filtered AND Sorted list
	let selectedStationIds = new Set(); // Start empty
	let currentLanguage = 'en';
	let isPlaying = false;
	let currentPlayingStationId = null;
	let stationCache = new Map(); // Map<countryCode, Array<stationObject>>
	let lastSelectedCountries = [];
	let currentPage = 1;
	let sortColumn = 'votes'; // Initial sort by votes
	let sortDirection = 'desc';

	// Карта сопоставления жанров
	const genreMap = {
		// Ключ: Название категории в фильтре
		// Значение: Массив тегов (lowercase), относящихся к категории
		'Rock': ['rock', 'hard rock', 'classic rock', 'metal', 'heavy metal', 'alternative rock', 'punk rock', 'punk', 'metalcore', 'alternative', 'grunge', 'rock n roll', "rock'n'roll", 'rock and roll', 'psychobilly', 'goth', 'gothic rock', 'active rock', 'glam rock', 'art rock', 'post-punk', 'rockabilly', 'surf', 'progressive rock', 'indie rock', 'folk rock', 'black metal', 'death metal', 'heavy rock', 'pop rock', 'pop-rock', 'russian rock', 'rock en español', '80s rock', 'mainstream rock', 'modern rock'],
		'Pop': ['pop', 'dance pop', 'europop', 'electropop', 'indie pop', 'synthpop', 'j-pop', 'k-pop', 'kpop', 'jpop', 'latin pop', 'italian pop', 'greek pop', 'pop clásico', 'pop en español', 'pop en español e inglés', 'pop en ingles', 'pop en inglés', 'pop latino', 'pop music', 'música pop', 'soft pop', 'charts', 'top 40', 'top40', 'top 100', 'top100', 'top charts', 'top hits', 'hot hits', 'greatest hits', 'hits', 'música en español e inglés', 'música en inglés', 'música en español'],
		'ElectronicDance': ['electronic', 'techno', 'house', 'trance', 'electro', 'electronica', 'edm', 'drum and bass', 'dnb', 'dubstep', 'idm', 'minimal', 'goa', 'club', 'clubbing', 'club dance', 'club house', 'dance', 'dance music', 'eurodance', 'funky house', 'soulful house', 'tech house', 'minimal techno', 'progressive house', 'dj', 'dj mix', 'dj mixes', 'dj remix', 'dj sets', 'remix', 'remixes', 'breakbeat', 'garage', 'hardstyle', 'psytrance', 'synthwave', 'mashup', 'nu disco', 'underground', 'электронная', 'танцевальная'],
		'HipHopRapRnB': ['hip hop', 'rap', 'hiphop', 'hip-hop', 'rnb', 'r&b', 'trap', 'urban', 'urban contemporary', 'urban adult contemporary', 'classic hip hop', 'soul', 'funk', 'funky', 'groove', 'rap hiphop rnb', 'r&b/urban', 'música urbana'],
		'JazzBluesSoul': ['jazz', 'blues', 'smooth jazz', 'swing', 'bossa nova', 'big band', 'jazz fusion', 'cool jazz', 'free jazz', 'nu-jazz', 'vocal jazz', 'classic jazz', 'blues rock', 'soul'], // Soul дублируется, но здесь он ближе по контексту
		'ClassicalOpera': ['classical', 'opera', 'baroque', 'orchestral', 'symphony', 'classical music', 'classical piano', 'musica clasica romantica', 'klassik'],
		'ReggaeSkaDub': ['reggae', 'ska', 'dub', 'dancehall'],
		'FolkCountryWorld': ['folk', 'country', 'americana', 'bluegrass', 'singer-songwriter', 'world', 'ethnic', 'celtic', 'world music', 'folk music', 'classic country', 'new country', 'australian music', 'brazilian music', 'greek music', 'greek folk', 'greek folk music', 'greek traditional', 'mpb', 'narodna', 'volksmusik', 'folclor', 'folclore', 'folklore', 'russian hits'], // Russian hits часто ближе к фолку/эстраде
		'LatinMusic': ['latin', 'salsa', 'reggaeton', 'reggaetón', 'bachata', 'cumbia', 'tango', 'merengue', 'vallenato', 'latin music', 'musica latina', 'latina', 'latino', 'latino américa', 'latinoamerica', 'latinoamérica', 'música latina', 'cumbias', 'banda', 'mariachi', 'norteño', 'norteña', 'ranchera', 'rancheras', 'grupera', 'grupero', 'sierreño', 'regional mexican', 'regional mexicana', 'musica mexicana', 'musica regional', 'musica regional mexicana', 'música mexicana', 'música popular mexicana', 'música regional', 'música regional mexicana', 'música tradicional mexicana', 'banda norteña', 'banda tradicional'],
		'OldiesRetro': ['oldies', 'retro', '50s', '60s', '70s', '80s', '90s', 'vintage', 'golden oldies', 'goldies', 'classic hits 60s 70a 80s', 'disco', 'euro disco', 'italo disco', 'schlager', 'chanson', 'chansons françaises', 'crooners', 'old time radio', 'otr', '1940s', '1950s', '1960s', '1970s', '1980s', '1990s', '40s', '60\'s', '60er', '70\'s', '70er', '80\'s', '80er', '90\'s', '90er', 'flashback', 'nostalgia', 'música del recuerdo', 'ретро', 'лëгкая музыка'], // Диско можно отнести сюда
		'EasyListeningChillAmbient': ['easy listening', 'lounge', 'ambient', 'chillout', 'relax', 'relaxation', 'relaxing', 'downtempo', 'new age', 'meditation', 'sleep', 'smooth', 'smooth lounge', 'easy', 'soft', 'soft music', 'chillout+lounge', 'ambient and relaxation music', 'instrumental', 'piano', 'nature', 'space'],
		'TalkNewsSports': ['talk', 'news', 'sports', 'comedy', 'public radio', 'podcast', 'talk radio', 'news talk', 'current affairs', 'information', 'local news', 'local talk', 'interviews', 'info', 'información', 'informativa', 'noticias', 'national news', 'international news', 'world news', 'local information', 'community', 'government', 'politics', 'political talk', 'conservative talk', 'public service', 'spoken word', 'features', 'storytelling', 'humor', 'humour', 'debates y deportes', 'deporte', 'deportes', 'noticias y deportes', 'noticias y comentarios', 'noticias opinion', 'radio hablada', 'música y noticias', 'noticieros', 'traffic', 'weather', 'nachrichten'],
		'ChristianGospelSpiritual': ['christian', 'gospel', 'contemporary christian', 'christian music', 'christian praise&worship', 'christian-gospel', 'catholic', 'orthodox', 'orthodox christian', 'religion', 'religious', 'bible', 'biblia', 'jesus', 'worship', 'espiritual', 'evangelio', 'cristiana', 'radio cristiana', 'chrétien'],
		'CommunityCollegePublic': ['community radio', 'college', 'college radio', 'public', 'public radio', 'university', 'university radio', 'student', 'student radio', 'campus radio', 'independent', 'non-commercial', 'non-profit', 'freeform', 'eclectic', 'radio communautaire', 'radio comunitaria', 'radio publique', 'radio pública', 'freies radio', 'local radio', 'regional radio', 'radio universidad', 'radio universitaria'],
		'SoundtracksTheme': ['soundtrack', 'soundtracks', 'film', 'movie', 'anime', 'video game music', 'ost', 'theme'],
		'KidsFamily': ['children', 'kids', 'family'],
		'AdultContemporary': ['adult contemporary', 'ac', 'hot ac', 'hot adult contemporary', 'soft adult contemporary', 'adult hits', 'variety', 'variety hits'], // AC/Hits
		'OtherVarious': ['various', 'misc', 'miscellaneous', 'other', 'experimental', 'avant-garde', 'variada', 'variado', 'variedad', 'varios', 'various music', 'música variada', 'mixed'] // Для неопределенного
	};
	const tagToCategoryMap = new Map();
	for (const category in genreMap) {
		genreMap[category].forEach(tag => {
			// Если тег уже отнесен к категории, не перезаписываем
			if (!tagToCategoryMap.has(tag)) {
				tagToCategoryMap.set(tag, category);
			}
		});
	}

	// Строки для локализации
	const translations = {
		ru: {
			loading: "Загрузка...",
			loadingCountries: "Загрузка списка стран...",
			loadingStations: "Загрузка станций ({count} стран)...",
			loadFailedGeneric: "Загрузка данных не удалась. Попробуйте позже.",
			loadFailedCountries: "Не удалось загрузить список стран.",
			loadFailedStations: "Не удалось загрузить станции для выбранных стран.",
			selectCountriesPlaceholder: "Выберите страны...",
			selectGenresPlaceholder: "Выберите жанры...",
			searchPlaceholder: "Введите название станции...",
			infoTitle: "Как пользоваться:",
			infoStep1: "1. Выберите одну или несколько стран в фильтре слева.",
			infoStep2: "2. Используйте поиск или фильтр по жанру для уточнения списка радиостанций.",
			infoStep3: "3. Отметьте нужные станции галочками в таблице.",
			infoStep4: "4. Нажмите кнопку \"Скачать выбранные\", чтобы получить файл <code>live_streams.sii</code>.",
			infoFooter: "Поместите скачанный файл в папку: \"<code>Документы\\Euro Truck Simulator 2</code>\" (или <code>American Truck Simulator</code>) с заменой.",
			selectedLabel: "Выбрано:",
			selectAllFiltered: "Выбрать всё",
			deselectAllFiltered: "Снять всё",
			selectVisible: "Выбрать видимые",
			deselectVisible: "Снять видимые",
			downloadSelected: "Скачать выбранные (.sii)",
			volumeLabel: "Громкость:",
			stopPlayback: "Остановить воспроизведение",
			noStationsFound: "Станции не найдены для выбранных фильтров.",
			promptSelectCountries: "Выберите страны для загрузки станций...",
			tableHeaderCheckbox: "",
			tableHeaderPlay: "Воспр.",
			tableHeaderName: "Название",
			tableHeaderGenre: "Жанр",
			tableHeaderLanguage: "Язык",
			tableHeaderBitrate: "Битрейт",
			tableHeaderVotes: "Голоса",
			filterTitle: "Фильтры",
			countryLabel: "Страны:",
			countryHelpText: "Можно выбрать несколько стран.",
			searchLabel: "Поиск по названию:",
			genreLabel: "Жанры:",
			genreHelpText: "Можно выбрать несколько жанров.",
			noGenresAvailable: "Жанры не найдены",
			errorPlayingStation: "Ошибка воспроизведения станции",
			noStationsSelected: "Станции для скачивания не выбраны.",
			stationDataNotFound: "Данные выбранных станций не найдены.",
			previousPage: "Пред.",
			nextPage: "След.",
			pageIndicator: "Страница {currentPage} из {totalPages}",
			toastInfoTitle: "Информация",
			toastWarningTitle: "Внимание",
			toastErrorTitle: "Ошибка",
			countryLoadWarn: "Не удалось загрузить данные для {count} стран.",
			Rock: "Рок",
			Pop: "Поп",
			ElectronicDance: "Электроника / Танцевальная",
			HipHopRapRnB: "Хип-Хоп / Рэп / R&B",
			JazzBluesSoul: "Джаз / Блюз / Соул",
			ClassicalOpera: "Классика / Опера",
			ReggaeSkaDub: "Регги / Ска / Даб",
			FolkCountryWorld: "Фолк / Кантри / Этно",
			LatinMusic: "Латиноамериканская",
			OldiesRetro: "Ретро / Старые хиты",
			EasyListeningChillAmbient: "Спокойная / Чиллаут",
			TalkNewsSports: "Разговорное / Новости / Спорт",
			ChristianGospelSpiritual: "Религия / Госпел",
			CommunityCollegePublic: "Общественное / Студенческое",
			SoundtracksTheme: "Саундтреки / Темы",
			KidsFamily: "Детское / Семейное",
			AdultContemporary: "Современное взрослое (AC)",
			OtherVarious: "Разное / Другое",
			linkOldVersion: "Старая версия",
            linkRadioEditor: "Редактор Радио",
		},
		en: {
			loading: "Loading...",
			loadingCountries: "Loading country list...",
			loadingStations: "Loading stations ({count} countries)...",
			loadFailedGeneric: "Data loading failed. Please try again later.",
			loadFailedCountries: "Could not load country list.",
			loadFailedStations: "Could not load stations for the selected countries.",
			selectCountriesPlaceholder: "Select countries...",
			selectGenresPlaceholder: "Select genres...",
			searchPlaceholder: "Enter station name...",
			infoTitle: "How to use:",
			infoStep1: "1. Select one or more countries in the filter on the left.",
			infoStep2: "2. Use search or genre filter to refine the list of radio stations.",
			infoStep3: "3. Check the desired stations in the table.",
			infoStep4: "4. Click the \"Download selected\" button to get the <code>live_streams.sii</code> file.",
			infoFooter: "Place the downloaded file into the folder: \"<code>Documents\\Euro Truck Simulator 2</code>\" (or <code>American Truck Simulator</code>) replacing the existing one.",
			selectedLabel: "Selected:",
			selectAllFiltered: "Select All",
			deselectAllFiltered: "Deselect All",
			selectVisible: "Select Visible",
			deselectVisible: "Deselect Visible",
			downloadSelected: "Download selected (.sii)",
			volumeLabel: "Volume:",
			stopPlayback: "Stop playback",
			noStationsFound: "No stations found for the selected filters.",
			promptSelectCountries: "Select countries to load stations...",
			tableHeaderCheckbox: "",
			tableHeaderPlay: "Play",
			tableHeaderName: "Name",
			tableHeaderGenre: "Genre",
			tableHeaderLanguage: "Language",
			tableHeaderBitrate: "Bitrate",
			tableHeaderVotes: "Votes",
			filterTitle: "Filters",
			countryLabel: "Countries:",
			countryHelpText: "You can select multiple countries.",
			searchLabel: "Search by name:",
			genreLabel: "Genres:",
			genreHelpText: "You can select multiple genres.",
			noGenresAvailable: "No genres available",
			errorPlayingStation: "Error playing station",
			noStationsSelected: "No stations selected for download.",
			stationDataNotFound: "Selected station data not found.",
			previousPage: "Previous",
			nextPage: "Next",
			pageIndicator: "Page {currentPage} of {totalPages}",
			toastInfoTitle: "Information",
			toastWarningTitle: "Warning",
			toastErrorTitle: "Error",
			countryLoadWarn: "Failed to load data for {count} countries.",
			Rock: "Rock",
			Pop: "Pop",
			ElectronicDance: "Electronic / Dance",
			HipHopRapRnB: "Hip-Hop / Rap / R&B",
			JazzBluesSoul: "Jazz / Blues / Soul",
			ClassicalOpera: "Classical / Opera",
			ReggaeSkaDub: "Reggae / Ska / Dub",
			FolkCountryWorld: "Folk / Country / World",
			LatinMusic: "Latin",
			OldiesRetro: "Oldies / Retro",
			EasyListeningChillAmbient: "Easy Listening / Chill / Ambient",
			TalkNewsSports: "Talk / News / Sports",
			ChristianGospelSpiritual: "Christian / Gospel / Spiritual",
			CommunityCollegePublic: "Community / College / Public",
			SoundtracksTheme: "Soundtracks / Theme",
			KidsFamily: "Kids / Family",
			AdultContemporary: "Adult Contemporary",
			OtherVarious: "Other / Various",
			linkOldVersion: "Old Version",
            linkRadioEditor: "Radio Editor",
		}
	};

	// --- Основные Функции ---

	function showLoading(text = translations[currentLanguage].loading) {
		loadingTextElement.textContent = text;
		loadingOverlay.classList.remove('d-none');
		loadingOverlay.classList.add('d-flex');
	}

	function hideLoading() {
		loadingOverlay.classList.add('d-none');
		loadingOverlay.classList.remove('d-flex');
	}

	function showToast(message, type = 'info', delay = 5000) {
		if (!toastContainer) return;
		const T = translations[currentLanguage];
		let title = T.toastInfoTitle;
		let iconHtml = '<i class="bi bi-info-circle-fill me-2"></i>';
		let bg = 'bg-info text-dark';
		let btnClose = '';
		switch (type) {
			case 'warning':
				title = T.toastWarningTitle;
				iconHtml = '<i class="bi bi-exclamation-triangle-fill me-2"></i>';
				bg = 'bg-warning text-dark';
				break;
			case 'error':
				title = T.toastErrorTitle;
				iconHtml = '<i class="bi bi-x-octagon-fill me-2"></i>';
				bg = 'bg-danger text-white';
				btnClose = 'btn-close-white';
				break;
			case 'success':
				title = "Success";
				iconHtml = '<i class="bi bi-check-circle-fill me-2"></i>';
				bg = 'bg-success text-white';
				btnClose = 'btn-close-white';
				break;
		}
		const toastId = 'toast-' + Date.now();
		const toastHtml = `<div id="${toastId}" class="toast ${bg}" role="alert" aria-live="assertive" aria-atomic="true" data-bs-delay="${delay}"><div class="toast-header ${bg === 'bg-danger text-white' || bg === 'bg-success text-white' ? 'text-white' : 'text-dark'} border-0">${iconHtml}<strong class="me-auto">${title}</strong><button type="button" class="btn-close ${btnClose}" data-bs-dismiss="toast" aria-label="Close"></button></div><div class="toast-body">${message}</div></div>`;
		toastContainer.insertAdjacentHTML('beforeend', toastHtml);
		const el = document.getElementById(toastId);
		const toast = new bootstrap.Toast(el, {
			autohide: delay > 0,
			delay: delay
		});
		el.addEventListener('hidden.bs.toast', () => el.remove());
		toast.show();
	}

	function translateUI() {
		const T = translations[currentLanguage];
		document.documentElement.lang = currentLanguage;
		document.querySelectorAll('[data-translate]').forEach(el => {
			const k = el.dataset.translate;
			if (T[k] !== undefined) el.textContent = T[k];
		});
		document.querySelectorAll('[data-translate-html]').forEach(el => {
			const k = el.dataset.translateHtml;
			if (T[k] !== undefined) el.innerHTML = T[k];
		});
		document.querySelectorAll('[data-translate-title]').forEach(el => {
			const k = el.dataset.translateTitle;
			if (T[k] !== undefined) el.title = T[k];
		});
		if (tomSelectCountries) {
			tomSelectCountries.settings.placeholder = T.selectCountriesPlaceholder;
			if (tomSelectCountries.control_input) tomSelectCountries.control_input.placeholder = T.selectCountriesPlaceholder;
		}
		if (tomSelectGenres) {
			tomSelectGenres.settings.placeholder = T.selectGenresPlaceholder;
			if (tomSelectGenres.control_input) tomSelectGenres.control_input.placeholder = T.selectGenresPlaceholder;
		}
		searchInput.placeholder = T.searchPlaceholder;
		const placeholderDiv = tableContainer.querySelector('div.alert-warning, div.text-center, div.alert-danger');
		if (placeholderDiv) {
			if (placeholderDiv.classList.contains('alert-warning')) placeholderDiv.textContent = T.noStationsFound;
			else if (placeholderDiv.classList.contains('text-center')) placeholderDiv.textContent = T.promptSelectCountries;
		}
		const tableHead = document.querySelector('#station-table thead tr');
		if (tableHead) {
			const h = tableHead.querySelectorAll('th');
			h[1].textContent = T.tableHeaderPlay;
			h[2].textContent = T.tableHeaderName;
			h[3].textContent = T.tableHeaderGenre;
			h[4].textContent = T.tableHeaderLanguage;
			h[5].textContent = T.tableHeaderBitrate + " kbit/s";
			h[6].textContent = T.tableHeaderVotes;
		}
		if (paginationContainer.querySelector('ul')) {
			const totalP = Math.ceil(filteredStations.length / ITEMS_PER_PAGE) || 1;
			renderPaginationControls(currentPage, totalP);
		}
		translateDiv.querySelectorAll('img').forEach(img => img.classList.toggle('active', img.dataset.lang === currentLanguage));
	}

	function setLanguage(lang) {
		currentLanguage = translations[lang] ? lang : 'en';
		translateUI();
		try {
			localStorage.setItem('ets2RadioLang', currentLanguage);
		} catch (e) {
			/* Ignore */
		}
		updateGenreFilter();
		if (allStations.length > 0 || filteredStations.length > 0 || tableContainer.querySelector('#station-table')) {
			applyFiltersAndRenderTable();
		}
	}

	function trySwitchGlobalApiEndpoint() {
		const currentIndex = API_ENDPOINTS.indexOf(currentApiEndpoint);
		if (currentIndex >= 0 && currentIndex < API_ENDPOINTS.length - 1) {
			currentApiEndpoint = API_ENDPOINTS[currentIndex + 1];
			activeApiUrl = API_BASE_URL.replace('{endpoint}', currentApiEndpoint);
			console.warn(`Switched global API endpoint to: ${currentApiEndpoint}`);
			return true;
		}
		console.error("All global API endpoints failed.");
		return false;
	}

	async function loadCountries() {
		showLoading(translations[currentLanguage].loadingCountries);
		let loaded = false;
		let initialEp = currentApiEndpoint;
		let attempts = 0;
		while (!loaded && API_ENDPOINTS.includes(currentApiEndpoint) && attempts < API_ENDPOINTS.length) {
			attempts++;
			try {
				const res = await fetch(`${activeApiUrl}/countries?hidebroken=true&reverse=true&order=stationcount`, {
					signal: AbortSignal.timeout(FETCH_TIMEOUT)
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const countries = await res.json();
				const opts = countries.filter(c => c.name && c.iso_3166_1 && c.stationcount > 0).map(c => ({
					value: c.iso_3166_1,
					text: `${c.name.replace(/^The /, '')}`
				})); /* No sort needed due to API order */
				tomSelectCountries.clearOptions();
				tomSelectCountries.addOptions(opts);
				tomSelectCountries.enable();
				loaded = true;
				hideLoading();
				return;
			} catch (error) {
				console.error(`Failed countries from ${currentApiEndpoint}:`, error);
				if (!trySwitchGlobalApiEndpoint()) {
					showToast(translations[currentLanguage].loadFailedCountries, 'error');
					hideLoading();
					return;
				}
			}
		}
		if (!loaded) {
			showToast(translations[currentLanguage].loadFailedCountries, 'error');
			hideLoading();
		}
	}

	async function handleCountrySelectionChange(currentSelection) {
		const added = currentSelection.filter(c => !lastSelectedCountries.includes(c));
		const removed = lastSelectedCountries.filter(c => !currentSelection.includes(c));
		let needsUpdate = false;
		if (removed.length > 0) {
			removed.forEach(c => stationCache.delete(c));
			needsUpdate = true;
		}
		const toLoad = added.filter(c => !stationCache.has(c));
		if (toLoad.length > 0) {
			showLoading(translations[currentLanguage].loadingStations.replace('{count}', toLoad.length));
			const promises = toLoad.map(c => fetchStationsForCountry(c));
			const results = await Promise.allSettled(promises);
			let sLoads = 0,
				fLoads = 0;
			results.forEach((r, i) => {
				const c = toLoad[i];
				if (r.status === 'fulfilled' && r.value) {
					const p = processAndDeduplicateStations(r.value);
					stationCache.set(c, p.length > 0 ? p : []);
					if (p.length > 0) sLoads++;
				} else {
					fLoads++;
					console.error(`Failed ${c}:`, r.reason);
				}
			});
			hideLoading();
			if (sLoads > 0) needsUpdate = true;
			if (fLoads > 0) {
				showToast(translations[currentLanguage].countryLoadWarn.replace('{count}', fLoads), 'warning', 7000);
			}
		} else if (added.length > 0) {
			needsUpdate = true;
		}
		if (needsUpdate || currentSelection.length !== lastSelectedCountries.length) {
			let combined = [];
			currentSelection.forEach(c => {
				if (stationCache.has(c)) combined.push(...stationCache.get(c));
			});
			allStations = finalProcessAndSort(combined);
			selectedStationIds.clear();
			currentPage = 1;
			updateGenreFilter();
		}
		lastSelectedCountries = [...currentSelection];
		applyFiltersAndRenderTable();
	}

	async function fetchStationsForCountry(countryCode) {
		const params = new URLSearchParams({
			countrycode: countryCode,
			order: 'votes',
			reverse: 'true',
			codec: 'MP3',
			hidebroken: 'true'
		});
		let currentTryEp = currentApiEndpoint;
		const tried = new Set();
		let attempts = 0;
		while (API_ENDPOINTS.includes(currentTryEp) && attempts < API_ENDPOINTS.length * 2) {
			attempts++;
			if (tried.has(currentTryEp)) {
				const idx = API_ENDPOINTS.indexOf(currentTryEp);
				currentTryEp = API_ENDPOINTS[(idx + 1) % API_ENDPOINTS.length];
				continue;
			}
			const url = `${API_BASE_URL.replace('{endpoint}', currentTryEp)}/stations/search?${params.toString()}`;
			tried.add(currentTryEp);
			try {
				const res = await fetch(url, {
					signal: AbortSignal.timeout(FETCH_TIMEOUT)
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				return await res.json();
			} catch (error) {
				console.warn(`Attempt ${attempts} fail ${countryCode} on ${currentTryEp}:`, error);
				const idx = API_ENDPOINTS.indexOf(currentTryEp);
				currentTryEp = API_ENDPOINTS[(idx + 1) % API_ENDPOINTS.length];
			}
		}
		throw new Error(`Could not fetch ${countryCode} after ${attempts} attempts.`);
	}

	function processAndDeduplicateStations(raw) {
		if (!raw?.length) return [];
		const map = new Map();
		raw.forEach(s => {
			const u = s.url_resolved || s.url;
			if (s?.stationuuid && u && !map.has(s.stationuuid)) {
				let lang = (s.languagecodes || s.countrycode || '').split(',')[0].trim().toUpperCase();
				if (!lang) lang = 'N/A';
				map.set(s.stationuuid, {
					id: s.stationuuid,
					name: (s.name || 'Unknown').trim().replace(/"/g, "'").replace(/\|/g, "ǀ"),
					url: u,
					genre: (s.tags || 'N/A').split(",").map(t => t.trim()).filter(t => t).slice(0, 3).join(', '),
					country: s.countrycode || 'N/A',
					language: lang,
					bitrate: s.bitrate > 1000 ? Math.round(s.bitrate / 1000) : (s.bitrate || 0),
					votes: s.votes || 0
				});
			}
		});
		return Array.from(map.values());
	}

	function finalProcessAndSort(combined) {
		if (!combined?.length) return [];
		const map = new Map();
		combined.forEach(s => map.set(s.id, s));
		return Array.from(map.values()).sort((a, b) => b.votes - a.votes);
	}

	function updateGenreFilter() {
		if (!tomSelectGenres) return;
		const T = translations[currentLanguage];
		const availableCategoryKeys = new Set();

		allStations.forEach(station => {
			station.genre.split(',')
				.map(tag => tag.trim().toLowerCase())
				.filter(tag => tag && tag !== 'n/a')
				.forEach(tag => {
					const categoryKey = tagToCategoryMap.get(tag);
					if (categoryKey) {
						availableCategoryKeys.add(categoryKey);
					}
				});
		});

		// Сортируем КЛЮЧИ по ПЕРЕВЕДЕННЫМ названиям
		const sortedCategoryKeys = Array.from(availableCategoryKeys).sort((keyA, keyB) => {
			const nameA = T[keyA] || keyA;
			const nameB = T[keyB] || keyB;
			return nameA.localeCompare(nameB, currentLanguage);
		});

		const currentSelectedKeys = tomSelectGenres.getValue();

		tomSelectGenres.clearOptions();
		tomSelectGenres.addOptions(
			sortedCategoryKeys.map(categoryKey => ({
				value: categoryKey,
				text: T[categoryKey] || categoryKey
			}))
		);

		const validSelections = currentSelectedKeys.filter(key => sortedCategoryKeys.includes(key));
		tomSelectGenres.setValue(validSelections, true);

		if (sortedCategoryKeys.length > 0) {
			tomSelectGenres.enable();
		} else {
			tomSelectGenres.disable();
		}
	}

	function applyFiltersAndRenderTable() {
		const term = searchInput.value.toLowerCase().trim();
		const selectedCategoryKeys = tomSelectGenres ? tomSelectGenres.getValue() : [];

		let currentFiltered;
		if (!allStations?.length) {
			currentFiltered = [];
		} else {
			currentFiltered = allStations.filter(s => {
				const nameOk = (s.name?.toLowerCase() ?? "").includes(term);

				let genreOk = true;
				if (selectedCategoryKeys.length > 0) {
					const stationTags = (s.genre?.toLowerCase() ?? "").split(',').map(g => g.trim()).filter(g => g);
					// Проверяем, относится ли ХОТЯ БЫ ОДИН тег станции к ХОТЯ БЫ ОДНОЙ выбранной КАТЕГОРИИ (по ключу)
					genreOk = stationTags.some(tag => {
						const categoryKeyOfTag = tagToCategoryMap.get(tag); // Находим КЛЮЧ категории тега
						// Тег подходит, если его КЛЮЧ категории есть среди выбранных КЛЮЧЕЙ
						return categoryKeyOfTag && selectedCategoryKeys.includes(categoryKeyOfTag);
					});
				}
				return nameOk && genreOk;
			});
		}
		if (sortColumn) {
			filteredStations = sortStations(currentFiltered, sortColumn, sortDirection);
		} else {
			filteredStations = currentFiltered;
		}
		const totalItems = filteredStations.length;
		const totalP = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
		if (currentPage > totalP) currentPage = totalP;
		if (currentPage < 1) currentPage = 1;
		const start = (currentPage - 1) * ITEMS_PER_PAGE;
		const pageItems = filteredStations.slice(start, start + ITEMS_PER_PAGE);
		renderTable(pageItems);
		renderPaginationControls(currentPage, totalP);
		updateSelectionInfo();
	}

	function sortStations(stations, column, direction) {
		if (!stations?.length || !column) return stations;
		const mod = direction === 'asc' ? 1 : -1;
		if (stations[0] && stations[0][column] === undefined) {
			console.warn(`Sort column "${column}" missing.`);
			return stations;
		}
		const sorted = [...stations].sort((a, b) => {
			let vA = a[column] ?? null;
			let vB = b[column] ?? null;
			if (vA === null && vB !== null) return 1 * mod;
			if (vA !== null && vB === null) return -1 * mod;
			if (vA === null && vB === null) return 0;
			if (typeof vA === 'string') return (vA || "").localeCompare(vB || "", currentLanguage) * mod;
			if (typeof vA === 'number') return (vA - vB) * mod;
			return 0;
		});
		return sorted;
	}

	function renderTable(stationsToRender) {
		const T = translations[currentLanguage];
		tableContainer.innerHTML = '';
		if (!stationsToRender?.length) {
			let msg = T.promptSelectCountries;
			if (lastSelectedCountries.length > 0) msg = T.noStationsFound;
			tableContainer.innerHTML = `<div class="alert alert-warning text-center p-5">${msg}</div>`;
			controlsDiv.classList.add('d-none');
			paginationContainer.innerHTML = '';
			return;
		}
		controlsDiv.classList.remove('d-none');
		const tableResponsive = document.createElement('div');
		tableResponsive.className = 'table-responsive';
		const table = document.createElement('table');
		table.id = 'station-table';
		table.className = 'table table-sm table-hover table-borderless';
		const thead = table.createTHead();
		thead.className = 'sticky-top';
		const hr = thead.insertRow();
		const hConf = [{
			k: 'tableHeaderCheckbox',
			w: '5%',
			s: false
		}, {
			k: 'tableHeaderPlay',
			w: '8%',
			s: false
		}, {
			k: 'tableHeaderName',
			w: '35%',
			s: true,
			by: 'name'
		}, {
			k: 'tableHeaderGenre',
			w: '20%',
			s: true,
			by: 'genre'
		}, {
			k: 'tableHeaderLanguage',
			w: '10%',
			s: true,
			by: 'language'
		}, {
			k: 'tableHeaderBitrate',
			w: '10%',
			s: true,
			by: 'bitrate'
		}, {
			k: 'tableHeaderVotes',
			w: '12%',
			s: true,
			by: 'votes'
		}];
		hConf.forEach(c => {
			const th = document.createElement('th');
			let txt = T[c.k] || '';
			if (c.by === 'bitrate') txt += " kbit/s";
			th.textContent = txt;
			th.style.width = c.w;
			if (c.s && c.by) {
				th.dataset.sortBy = c.by;
				th.setAttribute('role', 'columnheader');
				th.tabIndex = 0;
				const iSpan = document.createElement('span');
				iSpan.className = 'sort-icon';
				iSpan.innerHTML = '<i class="bi bi-arrow-down"></i><i class="bi bi-arrow-up"></i>';
				th.appendChild(iSpan);
				if (c.by === sortColumn) th.setAttribute('aria-sort', sortDirection === 'asc' ? 'ascending' : 'descending');
				else th.removeAttribute('aria-sort');
				th.addEventListener('click', handleSortHeaderClick);
				th.addEventListener('keydown', (e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						handleSortHeaderClick(e);
					}
				});
			}
			hr.appendChild(th);
		});
		const tbody = table.createTBody();
		stationsToRender.forEach(s => {
			const r = tbody.insertRow();
			r.dataset.stationId = s.id;
			const sel = selectedStationIds.has(s.id);
			const play = isPlaying && currentPlayingStationId === s.id;
			const cChk = r.insertCell();
			cChk.className = 'text-center align-middle';
			const chk = document.createElement('input');
			chk.className = 'form-check-input station-select';
			chk.type = 'checkbox';
			chk.value = s.id;
			chk.checked = sel;
			chk.setAttribute('aria-label', `Select ${s.name}`);
			cChk.appendChild(chk);
			const cPlay = r.insertCell();
			cPlay.className = 'text-center align-middle';
			const btn = document.createElement('button');
			btn.className = `btn ${play ? 'btn-warning' : 'btn-info'} btn-sm btn-play p-1`;
			btn.dataset.url = s.url;
			btn.dataset.stationId = s.id;
			btn.title = `${T.tableHeaderPlay} ${s.name}`;
			const i = document.createElement('span');
			i.className = `bi ${play ? 'bi-stop-fill' : 'bi-play-fill'}`;
			btn.appendChild(i);
			cPlay.appendChild(btn);
			const cName = r.insertCell();
			cName.textContent = s.name;
			cName.title = s.name;
			const cGenre = r.insertCell();
			cGenre.textContent = s.genre;
			cGenre.title = s.genre;
			r.insertCell().textContent = s.language;
			r.insertCell().textContent = s.bitrate;
			r.insertCell().textContent = s.votes;
		});
		tableResponsive.appendChild(table);
		tableContainer.appendChild(tableResponsive);
		attachTableEventHandlers();
	}

	function renderPaginationControls(pageNum, totalPagesNum) {
		paginationContainer.innerHTML = '';
		const T = translations[currentLanguage];
		if (totalPagesNum <= 1) return;
		const ul = document.createElement('ul');
		ul.className = 'pagination pagination-sm';
		const maxP = 7;
		const half = Math.floor(maxP / 2);
		ul.appendChild(createPageItem(pageNum - 1, pageNum, T.previousPage, pageNum === 1));
		let start = 1,
			end = totalPagesNum;
		if (totalPagesNum > maxP) {
			if (pageNum <= half + 1) {
				end = maxP - 1;
			} else if (pageNum >= totalPagesNum - half) {
				start = totalPagesNum - (maxP - 2);
			} else {
				start = pageNum - (half - 1);
				end = pageNum + (half - 1);
			}
		}
		if (start > 1) {
			ul.appendChild(createPageItem(1, pageNum));
			if (start > 2) ul.appendChild(createEllipsisItem());
		}
		for (let i = start; i <= end; i++) {
			ul.appendChild(createPageItem(i, pageNum));
		}
		if (end < totalPagesNum) {
			if (end < totalPagesNum - 1) ul.appendChild(createEllipsisItem());
			ul.appendChild(createPageItem(totalPagesNum, pageNum));
		}
		ul.appendChild(createPageItem(pageNum + 1, pageNum, T.nextPage, pageNum === totalPagesNum));
		paginationContainer.appendChild(ul);
		paginationContainer.querySelectorAll('.page-link[data-page]').forEach(l => l.addEventListener('click', handlePaginationClick));
	}

	function createPageItem(pageNum, currentNum, text = null, disabled = false) {
		const li = document.createElement('li');
		li.className = `page-item ${pageNum === currentNum ? 'active' : ''} ${disabled ? 'disabled' : ''}`;
		const link = document.createElement(disabled ? 'span' : 'a');
		link.className = 'page-link';
		link.textContent = text ?? pageNum;
		if (!disabled) {
			link.href = '#';
			link.dataset.page = pageNum;
			if (pageNum === currentNum) link.setAttribute('aria-current', 'page');
		}
		li.appendChild(link);
		return li;
	}

	function createEllipsisItem() {
		const li = document.createElement('li');
		li.className = 'page-item disabled';
		const span = document.createElement('span');
		span.className = 'page-link';
		span.innerHTML = '…';
		li.appendChild(span);
		return li;
	}

	function handlePaginationClick(e) {
		e.preventDefault();
		const link = e.currentTarget;
		if (link.parentElement.classList.contains('disabled') || link.parentElement.classList.contains('active')) return;
		const targetPage = parseInt(link.dataset.page, 10);
		if (!isNaN(targetPage) && targetPage !== currentPage) {
			currentPage = targetPage;
			applyFiltersAndRenderTable();
			tableContainer.scrollIntoView({
				behavior: 'smooth',
				block: 'start'
			});
		}
	}

	function handleSortHeaderClick(e) {
		const th = e.currentTarget;
		const col = th.dataset.sortBy;
		if (!col) return;

		let dir = 'asc';

		if (col === sortColumn) {
			dir = sortDirection === 'asc' ? 'desc' : 'asc';
		}
		else if (col === 'votes') {
			dir = 'desc';
		}

		sortColumn = col;
		sortDirection = dir;
		currentPage = 1;

		applyFiltersAndRenderTable();
	}

	function attachTableEventHandlers() {
		tableContainer.querySelectorAll('.station-select').forEach(cb => cb.addEventListener('change', handleCheckboxChange));
		tableContainer.querySelectorAll('.btn-play').forEach(btn => btn.addEventListener('click', handlePlayButtonClick));
	}

	function handleCheckboxChange(e) {
		e.target.checked ? selectedStationIds.add(e.target.value) : selectedStationIds.delete(e.target.value);
		updateSelectionInfo();
	}

	function handlePlayButtonClick(e) {
		const btn = e.currentTarget;
		const url = btn.dataset.url;
		const id = btn.dataset.stationId;
		if (btn.disabled) return;
		if (isPlaying && currentPlayingStationId === id) {
			stopAudioPlayback();
			return;
		}
		if (isPlaying) stopAudioPlayback();
		const iconSpan = btn.querySelector('span');
		if (iconSpan) {
			iconSpan.className = 'spinner-border spinner-border-sm';
			iconSpan.setAttribute('role', 'status');
		}
		btn.disabled = true;
		audioPlayer.src = url;
		audioPlayer.load();
		audioPlayer.play().then(() => {
			isPlaying = true;
			currentPlayingStationId = id;
			btn.classList.replace('btn-info', 'btn-warning');
			if (iconSpan) {
				iconSpan.className = 'bi bi-stop-fill';
				iconSpan.removeAttribute('role');
			}
			btn.disabled = false;
		}).catch(err => {
			console.error("Audio fail:", err);
			showToast(`${translations[currentLanguage].errorPlayingStation}: ${url}\n(${err.message})`, 'error', 7000);
			if (iconSpan) {
				iconSpan.className = 'bi bi-play-fill';
				iconSpan.removeAttribute('role');
			}
			btn.classList.replace('btn-warning', 'btn-info');
			btn.disabled = false;
			if (currentPlayingStationId === id) stopAudioPlayback();
		});
	}

	function stopAudioPlayback() {
		if (!isPlaying && !currentPlayingStationId) return;
		const pId = currentPlayingStationId;
		audioPlayer.pause();
		audioPlayer.src = '';
		isPlaying = false;
		currentPlayingStationId = null;
		if (pId) {
			const btn = tableContainer.querySelector(`.btn-play[data-station-id="${pId}"]`);
			if (btn) {
				btn.classList.replace('btn-warning', 'btn-info');
				const icon = btn.querySelector('span');
				if (icon) {
					icon.className = 'bi bi-play-fill';
					icon.removeAttribute('role');
				}
				btn.disabled = false;
			}
		}
	}

	function updateSelectionInfo() {
		const count = selectedStationIds.size;
		selectionCountElement.textContent = count;
		downloadCountElement.textContent = count;
		downloadBtn.disabled = count === 0;
		const visCount = tableContainer.querySelectorAll('.station-select').length;
		const filtCount = filteredStations.length;
		selectVisibleBtn.disabled = visCount === 0;
		deselectVisibleBtn.disabled = visCount === 0 || !Array.from(tableContainer.querySelectorAll('.station-select')).some(cb => cb.checked);
		selectAllFilteredBtn.disabled = filtCount === 0;
		deselectAllFilteredBtn.disabled = filtCount === 0 || count === 0;
	}

	function generateAndDownloadSii() {
		const T = translations[currentLanguage];
		if (selectedStationIds.size === 0) {
			showToast(T.noStationsSelected, 'warning');
			return;
		}
		const stations = allStations.filter(s => selectedStationIds.has(s.id));
		if (stations.length === 0 && selectedStationIds.size > 0) {
			showToast(T.stationDataNotFound, 'error');
			return;
		}
		let out = "SiiNunit\n{\nlive_stream_def : .live_streams {\n";
		stations.forEach((s, i) => {
			const name = (s.name || 'Unknown').replace(/\|/g, 'I').replace(/"/g, '`').trim();
			const genre = (s.genre || 'Various').replace(/\|/g, '/').replace(/"/g, '`').trim();
			const lang = s.language;
			const bit = s.bitrate || 128;
			if (s.url) out += ` stream_data[${/*i*/""}]: "${s.url}|${name}|${genre}|${lang}|${bit}|0"\n`;
		});
		out += '\n}\n\n}'; //`\n stream_count: ${stations.length}\n}\n\n}`;
		try {
			downloadFile(out, "live_streams.sii", "text/plain;charset=utf-8");
		} catch (e) {
			console.error("DL Error:", e);
			showToast("File download failed.", 'error');
		}
	}

	function downloadFile(data, filename, type) {
		const file = new Blob([data], {
			type: type
		});
		const a = document.createElement("a");
		const url = URL.createObjectURL(file);
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		setTimeout(() => {
			document.body.removeChild(a);
			window.URL.revokeObjectURL(url);
		}, 0);
	}

	// --- Инициализация ---
	const savedLang = localStorage.getItem('ets2RadioLang');
	const browserLang = navigator.language || navigator.userLanguage;
	setLanguage(savedLang || (browserLang?.startsWith('ru') ? 'ru' : 'en'));
	updateSelectionInfo(); // Update UI for initial empty selection
	tomSelectCountries = new TomSelect(countrySelectElement, {
		plugins: ['remove_button'],
		create: false,
		placeholder: translations[currentLanguage].selectCountriesPlaceholder,
		maxItems: null,
		hideSelected: true,
		maxOptions: null,
		closeAfterSelect: false,
		render: {
			no_results: (d, e) => `<div class="no-results">No countries matching "${e(d.input)}"</div>`
		},
		onInitialize: function() {
			this.disable();
		},
		onChange: function() {
			handleCountrySelectionChange(this.getValue());
		}
	});
	tomSelectGenres = new TomSelect(genreSelectElement, {
		plugins: ['remove_button'],
		create: false,
		placeholder: translations[currentLanguage].selectGenresPlaceholder,
		maxItems: null,
		hideSelected: true,
		closeAfterSelect: false,
		render: {
			no_results: () => `<div class="no-results">${translations[currentLanguage].noGenresAvailable}</div>`,
			option: (d, e) => `<div>${e(d.text)}</div>`
		},
		onInitialize: function() {
			this.disable();
		},
		onChange: function() {
			currentPage = 1;
			applyFiltersAndRenderTable();
		}
	});

	// --- Слушатели событий ---
	searchInput.addEventListener('input', () => {
		clearTimeout(searchDebounceTimer);
		searchDebounceTimer = setTimeout(() => {
			currentPage = 1;
			applyFiltersAndRenderTable();
		}, SEARCH_DEBOUNCE_DELAY);
	});
	selectVisibleBtn.addEventListener('click', () => {
		tableContainer.querySelectorAll('.station-select').forEach(cb => {
			if (!cb.checked) {
				cb.checked = true;
				selectedStationIds.add(cb.value);
			}
		});
		updateSelectionInfo();
	});
	deselectVisibleBtn.addEventListener('click', () => {
		tableContainer.querySelectorAll('.station-select').forEach(cb => {
			if (cb.checked) {
				cb.checked = false;
				selectedStationIds.delete(cb.value);
			}
		});
		updateSelectionInfo();
	});
	selectAllFilteredBtn.addEventListener('click', () => {
		if (!filteredStations?.length) return;
		filteredStations.forEach(s => selectedStationIds.add(s.id));
		tableContainer.querySelectorAll('.station-select').forEach(cb => {
			if (!cb.checked && selectedStationIds.has(cb.value)) cb.checked = true;
		});
		updateSelectionInfo();
	});
	deselectAllFilteredBtn.addEventListener('click', () => {
		if (!filteredStations?.length || selectedStationIds.size === 0) return;
		const filtIds = filteredStations.map(s => s.id);
		filtIds.forEach(id => selectedStationIds.delete(id));
		tableContainer.querySelectorAll('.station-select').forEach(cb => {
			if (cb.checked && !selectedStationIds.has(cb.value)) cb.checked = false;
		});
		updateSelectionInfo();
	});
	stopPlaybackBtn.addEventListener('click', stopAudioPlayback);
	volumeControl.addEventListener('input', (e) => {
		audioPlayer.volume = e.target.value;
	});
	translateDiv.addEventListener('click', (e) => {
		if (e.target.tagName === 'IMG' && e.target.dataset.lang) setLanguage(e.target.dataset.lang);
	});
	downloadBtn.addEventListener('click', generateAndDownloadSii);

	// --- Начальная настройка ---
	controlsDiv.classList.add('d-none');
	audioPlayer.volume = volumeControl.value;
	loadCountries();

}); // Конец DOMContentLoaded