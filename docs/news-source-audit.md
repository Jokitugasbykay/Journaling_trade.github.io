# News source audit

Audit finished: 2026-10-08T17:37:18.180258+00:00. Checked **525** unique source IDs.

## Results

| Collector state | Sources |
| --- | ---: |
| blocked | 3 |
| external | 196 |
| no_parsed_headlines | 4 |
| unavailable | 2 |
| working | 320 |

Portal reachability: {'reachable': 404, 'unavailable': 42, 'blocked': 79}.

**Audit network limitation:** 3 portal requests failed DNS resolution in this environment. These results do not establish that those publishers are globally offline.

Transient unavailable endpoints were rechecked with a 20-second socket timeout and at most six concurrent workers.

An external source is a publisher portal link without a configured automatic collector. A reachable portal does not imply its feed is collectable. Blocked/unavailable results describe this audit location and time. XML entries with no parsed headlines may be old, unsupported Atom, off-domain, or rejected by headline validation; production currently keeps headlines dated within seven days.

## Validated official feed candidates

| Source | Endpoint | Publisher evidence | Current parsed headlines |
| --- | --- | --- | ---: |

## Regional coverage

Target: at least four distinct working publisher IDs in each configured dataset. A working endpoint produced validated headlines during this audit; availability can change.

| Region | Configured portals | Working portals |
| --- | ---: | ---: |
| AE | 4 | 4 |
| AR | 8 | 5 |
| AT | 8 | 6 |
| AU | 8 | 5 |
| BD | 9 | 4 |
| BH | 4 | 4 |
| CA | 8 | 4 |
| CH | 8 | 5 |
| CL | 9 | 4 |
| CN | 10 | 4 |
| CO | 8 | 4 |
| CR | 8 | 4 |
| CZ | 8 | 7 |
| DE | 8 | 6 |
| DEFAULT | 8 | 8 |
| DK | 8 | 4 |
| DZ | 8 | 5 |
| EG | 9 | 4 |
| ES | 8 | 4 |
| ET | 10 | 4 |
| FI | 8 | 6 |
| FR | 8 | 6 |
| GB | 8 | 6 |
| GH | 8 | 4 |
| GLOBAL | 22 | 19 |
| HU | 8 | 7 |
| ID | 9 | 5 |
| IE | 8 | 6 |
| IL | 5 | 5 |
| IN | 8 | 5 |
| IQ | 4 | 4 |
| IR | 8 | 4 |
| IT | 8 | 4 |
| JO | 6 | 6 |
| JP | 8 | 4 |
| KE | 8 | 4 |
| KR | 8 | 5 |
| KW | 5 | 5 |
| LB | 4 | 4 |
| LK | 9 | 5 |
| MA | 10 | 5 |
| MX | 8 | 4 |
| MY | 9 | 4 |
| NG | 9 | 6 |
| NL | 8 | 4 |
| NO | 8 | 5 |
| NZ | 8 | 4 |
| OM | 4 | 4 |
| PE | 8 | 5 |
| PH | 8 | 4 |
| PK | 8 | 5 |
| PL | 8 | 5 |
| QA | 5 | 5 |
| RO | 9 | 4 |
| SA | 5 | 5 |
| SE | 8 | 4 |
| SG | 9 | 6 |
| TH | 8 | 4 |
| TR | 8 | 5 |
| TW | 12 | 5 |
| TZ | 8 | 4 |
| UA | 8 | 4 |
| UG | 8 | 4 |
| US | 8 | 7 |
| UY | 9 | 4 |
| VN | 8 | 5 |
| ZA | 9 | 4 |
| global_founder | 8 | 8 |

## Endpoint details

| Source | State | Portal | Configured feeds |
| --- | --- | --- | --- |
| 1News | external | [Publisher](https://www.1news.co.nz) (reachable) | No collector configured |
| 24 Horas | external | [Publisher](https://www.24horas.cl) (reachable) | No collector configured |
| 24.hu | working | [Publisher](https://24.hu) (reachable) | [working](https://24.hu/feed/) |
| 444 | working | [Publisher](https://444.hu) (reachable) | [working](https://444.hu/feed) |
| ABC | external | [Publisher](https://www.abc.es) (unavailable) | No collector configured |
| ABC News Australia | working | [Publisher](https://www.abc.net.au/news) (reachable) | [working](https://www.abc.net.au/news/feed/51120/rss.xml) |
| ABS-CBN News | external | [Publisher](https://news.abs-cbn.com) (blocked) | No collector configured |
| Ada Derana | working | [Publisher](https://www.adaderana.lk) (reachable) | [working](https://www.adaderana.lk/news-sitemap.xml) |
| Addis Fortune | working | [Publisher](https://addisfortune.news) (reachable) | [working](https://addisfortune.news/feed/) |
| Addis Standard | external | [Publisher](https://addisstandard.com) (blocked) | No collector configured |
| Adevărul | working | [Publisher](https://adevarul.ro) (reachable) | [working](https://adevarul.ro/rss/index) |
| AFP | external | [Publisher](https://www.afp.com/en) (unavailable) | No collector configured |
| Aftenposten | working | [Publisher](https://www.aftenposten.no) (reachable) | [working](https://www.aftenposten.no/rss) |
| Aftonbladet | external | [Publisher](https://www.aftonbladet.se) (reachable) | No collector configured |
| Agencia EFE | external | [Publisher](https://www.efe.com) (blocked) | No collector configured |
| Agerpres | external | [Publisher](https://www.agerpres.ro) (blocked) | No collector configured |
| Al Ayam | working | [Publisher](https://www.alayam.com) (reachable) | [working](https://www.alayam.com) |
| Al Bilad Press | working | [Publisher](https://www.albiladpress.com) (reachable) | [working](https://www.albiladpress.com) |
| Al Jarida | working | [Publisher](https://aljarida.com) (reachable) | [working](https://www.aljarida.com/) |
| Al Jazeera | working | [Publisher](https://www.aljazeera.com/) (reachable) | [working](https://www.aljazeera.com/xml/rss/all.xml) |
| Al Mamlaka | working | [Publisher](https://www.almamlakatv.com) (reachable) | [working](https://www.almamlakatv.com/sitemap-news.xml) |
| Al Rai Media | working | [Publisher](https://www.alraimedia.com) (reachable) | [working](https://www.alraimedia.com) |
| Al Sharq | working | [Publisher](https://al-sharq.com) (reachable) | [working](https://al-sharq.com/rss/latestNews) |
| Al Watan Saudi Arabia | working | [Publisher](https://www.alwatan.com.sa) (reachable) | [working](https://www.alwatan.com.sa/rssFeed/1) |
| Al-Ahram | blocked | [Publisher](https://english.ahram.org.eg) (blocked) | [blocked](https://english.ahram.org.eg) |
| Al-Masry Al-Youm | working | [Publisher](https://www.almasryalyoum.com) (reachable) | [working](https://www.almasryalyoum.com/rss/rssfeeds) |
| Algérie 360 | working | [Publisher](https://algerie360.com) (reachable) | [working](https://www.algerie360.com/news-sitemap.xml) |
| Ammon News | working | [Publisher](https://www.ammonnews.net) (reachable) | [working](https://www.ammonnews.net) |
| An-Nahar | working | [Publisher](https://www.annahar.com) (reachable) | [working](https://www.annahar.com) |
| Anadolu Agency | working | [Publisher](https://www.aa.com.tr) (reachable) | [working](https://www.aa.com.tr/en/rss/default?cat=guncel) |
| Andina | external | [Publisher](https://andina.pe) (reachable) | No collector configured |
| ANSA | working | [Publisher](https://www.ansa.it) (reachable) | [working](https://www.ansa.it/sito/notizie/topnews/topnews_rss.xml) |
| Antara News | working | [Publisher](https://www.antaranews.com) (unavailable) | [working](https://www.antaranews.com/rss/terkini.xml) |
| APS | external | [Publisher](https://www.aps.dz) (unavailable) | No collector configured |
| Arab Times Kuwait | working | [Publisher](https://www.arabtimesonline.com) (reachable) | [working](https://www.arabtimesonline.com/sitemaps/newsSitemap.xml) |
| Aristegui Noticias | working | [Publisher](https://aristeguinoticias.com) (reachable) | [working](https://editorial.aristeguinoticias.com/news-sitemap.xml) |
| Asharq Al-Awsat | working | [Publisher](https://aawsat.com) (reachable) | [working](https://aawsat.com/googlenews.xml) |
| Asharq News | working | [Publisher](https://www.asharq.com) (reachable) | [working](https://asharq.com/) |
| Associated Press | working | [Publisher](https://apnews.com/) (blocked) | [blocked](https://apnews.com/); [working](https://apnews.com/sports); [blocked](https://apnews.com/business); [blocked](https://apnews.com/politics) |
| Atheer | working | [Publisher](https://atheer.om) (reachable) | [working](https://www.atheer.om/) |
| Aujourd’hui le Maroc | working | [Publisher](https://aujourdhui.ma) (reachable) | [working](https://aujourdhui.ma/feed/) |
| B&FT Online | external | [Publisher](https://thebftonline.com) (reachable) | No collector configured |
| Baghdad Today | working | [Publisher](https://baghdadtoday.news) (reachable) | [working](https://baghdadtoday.news/rss.xml) |
| Bangkok Post | working | [Publisher](https://www.bangkokpost.com) (reachable) | [working](https://www.bangkokpost.com/rss/data/topstories.xml) |
| Barron's | working | [Publisher](https://www.barrons.com/) (blocked) | [working](https://www.barrons.com/bol_news_sitemap.xml) |
| BBC News | working | [Publisher](https://www.bbc.com/news) (reachable) | [working](https://feeds.bbci.co.uk/news/rss.xml); [working](https://feeds.bbci.co.uk/news/business/rss.xml); [working](https://feeds.bbci.co.uk/news/politics/rss.xml); [working](https://feeds.bbci.co.uk/sport/rss.xml) |
| bdnews24 | working | [Publisher](https://bdnews24.com) (reachable) | [working](https://bdnews24.com/news_sitemap.xml) |
| Berita Harian | external | [Publisher](https://www.bharian.com.my) (blocked) | No collector configured |
| Berita Harian SG | working | [Publisher](https://www.beritaharian.sg) (reachable) | [working](https://www.beritaharian.sg/googlenews.xml) |
| Berlingske | working | [Publisher](https://berlingske.dk) (reachable) | [working](https://www.berlingske.dk/news-sitemap.xml) |
| Bernama | external | [Publisher](https://www.bernama.com) (unavailable) | No collector configured |
| BigGo Finance | working | [Publisher](https://finance.biggo.com/) (reachable) | [working](https://finance.biggo.com/) |
| BioBioChile | working | [Publisher](https://www.biobiochile.cl) (unavailable) | [working](https://www.biobiochile.cl) |
| Bisnis Ekonomi | blocked | [Publisher](https://ekonomi.bisnis.com/) (blocked) | [blocked](https://ekonomi.bisnis.com/) |
| Bloomberg | working | [Publisher](https://www.bloomberg.com/asia) (blocked) | [working](https://feeds.bloomberg.com/markets/news.rss) |
| Borkena | working | [Publisher](https://borkena.com) (reachable) | [working](https://borkena.com) |
| BreakingNews.ie | working | [Publisher](https://www.breakingnews.ie) (reachable) | [working](https://www.breakingnews.ie/feed/all.rss) |
| Business Daily Africa | working | [Publisher](https://www.businessdailyafrica.com) (reachable) | [working](https://www.businessdailyafrica.com/bd/rss.xml) |
| Business Plus | working | [Publisher](https://businessplus.ie) (reachable) | [working](https://businessplus.ie/feed/) |
| Business Recorder | working | [Publisher](https://www.brecorder.com) (reachable) | [working](https://www.brecorder.com/feeds/latest-news) |
| Businessday NG | working | [Publisher](https://businessday.ng) (reachable) | [working](https://businessday.ng/feed/) |
| BusinessLIVE | external | [Publisher](https://www.businesslive.co.za) (reachable) | No collector configured |
| BusinessWorld | working | [Publisher](https://www.bworldonline.com) (reachable) | [working](https://bworldonline.com/feed/) |
| Børsen | external | [Publisher](https://borsen.dk) (reachable) | No collector configured |
| Búsqueda | external | [Publisher](https://www.busqueda.com.uy) (blocked) | No collector configured |
| Caixin Global | working | [Publisher](https://www.caixinglobal.com) (reachable) | [working](https://www.caixinglobal.com) |
| Calcalist Tech | working | [Publisher](https://www.calcalistech.com) (reachable) | [working](https://www.calcalistech.com/ctechnews) |
| Capital Ethiopia | external | [Publisher](https://www.capitalethiopia.com) (unavailable) | No collector configured |
| Capital FM News | external | [Publisher](https://www.capitalfm.co.ke/news) (reachable) | No collector configured |
| Caracol Radio | working | [Publisher](https://caracol.com.co) (reachable) | [working](https://caracol.com.co/arc/outboundfeeds/googlenewssitemap/latest/?outputType=xml) |
| CBC News | working | [Publisher](https://www.cbc.ca/news) (reachable) | [working](https://www.cbc.ca/webfeed/rss/rss-topstories) |
| CBS News | working | [Publisher](https://www.cbsnews.com) (reachable) | [working](https://www.cbsnews.com/latest/rss/main) |
| CCTV | external | [Publisher](https://www.cctv.com) (reachable) | No collector configured |
| Ceylon Today | external | [Publisher](https://ceylontoday.lk) (blocked) | No collector configured |
| Channels Television | working | [Publisher](https://www.channelstv.com) (reachable) | [working](https://www.channelstv.com/feed/) |
| ChimpReports | working | [Publisher](https://chimpreports.com) (reachable) | [working](https://chimpreports.com) |
| China Daily | working | [Publisher](https://www.chinadaily.com.cn) (reachable) | [working](https://www.chinadaily.com.cn) |
| China Times | working | [Publisher](https://www.chinatimes.com) (reachable) | [working](https://www.chinatimes.com/sitemaps/sitemap_todaynews.xml) |
| Citinewsroom | external | [Publisher](https://citinewsroom.com) (reachable) | No collector configured |
| Citizen Digital | external | [Publisher](https://citizen.digital) (reachable) | No collector configured |
| Clarín | working | [Publisher](https://www.clarin.com) (reachable) | [working](https://www.clarin.com/rss/lo-ultimo/) |
| CME FedWatch | external | [Publisher](https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html) (blocked) | No collector configured |
| CME Markets | external | [Publisher](https://www.cmegroup.com/markets.html?redirect=/markets/) (blocked) | No collector configured |
| CNA | working | [Publisher](https://www.channelnewsasia.com) (reachable) | [working](https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml) |
| CNA | external | [Publisher](https://www.cna.com.tw) (reachable) | No collector configured |
| CNBC | working | [Publisher](https://www.cnbc.com/markets/) (reachable) | [working](https://www.cnbc.com/id/100003114/device/rss/rss.html) |
| CNN Indonesia Ekonomi | working | [Publisher](https://www.cnnindonesia.com/ekonomi) (reachable) | [working](https://www.cnnindonesia.com/ekonomi/rss) |
| Cooperativa | unavailable | [Publisher](https://www.cooperativa.cl) (unavailable) | [unavailable](https://www.cooperativa.cl/noticias/site/tax/port/all/rss____1.xml) |
| Corriere del Ticino | external | [Publisher](https://www.cdt.ch) (unavailable) | No collector configured |
| Corriere della Sera | working | [Publisher](https://www.corriere.it) (reachable) | [working](https://www.corriere.it/salute/il-medico-risponde/news/sitemap.xml) |
| CP24 | external | [Publisher](https://www.cp24.com) (reachable) | No collector configured |
| CRHoy | working | [Publisher](https://www.crhoy.com) (reachable) | [working](https://crhoy.com/sitemaps/sitemap-news.xml) |
| CTV News | external | [Publisher](https://www.ctvnews.ca) (reachable) | No collector configured |
| Cumhuriyet | working | [Publisher](https://www.cumhuriyet.com.tr) (reachable) | [working](https://www.cumhuriyet.com.tr/sitemaps/news.xml) |
| Dagbladet | external | [Publisher](https://www.dagbladet.no) (reachable) | No collector configured |
| Dagens Nyheter | working | [Publisher](https://www.dn.se) (reachable) | [working](https://www.dn.se/rss/) |
| Dagens Næringsliv | external | [Publisher](https://www.dn.no) (reachable) | No collector configured |
| Daily FT | working | [Publisher](https://www.ft.lk) (reachable) | [working](https://www.ft.lk) |
| Daily Guide Network | working | [Publisher](https://dailyguidenetwork.com) (reachable) | [working](https://dailyguidenetwork.com/feed/) |
| Daily Maverick | external | [Publisher](https://www.dailymaverick.co.za) (reachable) | No collector configured |
| Daily Mirror Sri Lanka | working | [Publisher](https://www.dailymirror.lk) (reachable) | [working](https://www.dailymirror.lk/rss/breaking_news/108) |
| Daily Monitor | external | [Publisher](https://www.monitor.co.ug) (blocked) | No collector configured |
| Daily Nation | external | [Publisher](https://nation.africa/kenya) (blocked) | No collector configured |
| Daily News Egypt | working | [Publisher](https://www.dailynewsegypt.com) (reachable) | [working](https://www.dailynewsegypt.com/feed/) |
| Daily News Hungary | working | [Publisher](https://dailynewshungary.com) (reachable) | [working](https://dailynewshungary.com/feed) |
| Daily News Tanzania | working | [Publisher](https://dailynews.co.tz) (reachable) | [working](https://dailynews.co.tz/feed/) |
| Daily News Thailand | external | [Publisher](https://www.dailynews.co.th) (reachable) | No collector configured |
| Daily Sabah | working | [Publisher](https://www.dailysabah.com) (reachable) | [working](https://www.dailysabah.com/rssFeed/12/13) |
| Daily Times | working | [Publisher](https://dailytimes.com.pk) (reachable) | [working](https://dailytimes.com.pk/feed/) |
| Daily Trust | external | [Publisher](https://dailytrust.com) (reachable) | No collector configured |
| Dawn | working | [Publisher](https://www.dawn.com) (reachable) | [working](https://www.dawn.com/feeds/home) |
| De Telegraaf | external | [Publisher](https://www.telegraaf.nl) (blocked) | No collector configured |
| de Volkskrant | external | [Publisher](https://www.volkskrant.nl) (blocked) | No collector configured |
| Delfino | working | [Publisher](https://delfino.cr) (reachable) | [working](https://delfino.cr/sitemaps/news.xml) |
| Deník N | working | [Publisher](https://denikn.cz) (reachable) | [working](https://denikn.cz/feed/) |
| Der Spiegel | working | [Publisher](https://www.spiegel.de) (reachable) | [working](https://www.spiegel.de/schlagzeilen/index.rss) |
| Der Standard | working | [Publisher](https://www.derstandard.at) (reachable) | [working](https://www.derstandard.at/sitemaps/news.xml) |
| detikFinance | working | [Publisher](https://finance.detik.com/) (reachable) | [working](https://finance.detik.com/rss) |
| Deutsche Welle | working | [Publisher](https://www.dw.com/en/top-stories/s-9097) (reachable) | [working](https://rss.dw.com/xml/rss-en-all); [working](https://rss.dw.com/xml/rss-en-world); [working](https://rss.dw.com/xml/rss-en-bus); [working](https://rss.dw.com/xml/rss-en-sports); [working](https://rss.dw.com/xml/rss_en_science); [working](https://rss.dw.com/xml/rss_en_environment) |
| Dhaka Tribune | working | [Publisher](https://www.dhakatribune.com) (blocked) | [working](https://www.dhakatribune.com/feed/) |
| Diario Financiero | working | [Publisher](https://www.df.cl) (reachable) | [working](https://www.df.cl/noticias/site/sitemap_news.xml) |
| Die Presse | working | [Publisher](https://www.diepresse.com) (reachable) | [working](https://www.diepresse.com/rss//) |
| Die Welt | working | [Publisher](https://www.welt.de) (reachable) | [working](https://www.welt.de/sitemaps/newssitemap/newssitemap.xml) |
| Die Zeit | external | [Publisher](https://www.zeit.de) (blocked) | No collector configured |
| Digi24 | working | [Publisher](https://www.digi24.ro) (reachable) | [working](https://www.digi24.ro/rss) |
| Doha News | working | [Publisher](https://dohanews.co) (reachable) | [working](https://dohanews.co/feed/) |
| DR | working | [Publisher](https://www.dr.dk) (reachable) | [working](https://www.dr.dk/nyheder/service/feeds/allenyheder) |
| Dunya News | external | [Publisher](https://dunyanews.tv) (reachable) | No collector configured |
| Dutch News | external | [Publisher](https://www.dutchnews.nl) (reachable) | No collector configured |
| Dzerkalo Tyzhnia (ZN.UA) | working | [Publisher](https://zn.ua) (reachable) | [working](https://zn.ua/ukr/rss/full/) |
| Dziennik Gazeta Prawna | working | [Publisher](https://www.gazetaprawna.pl) (unavailable) | [working](https://www.gazetaprawna.pl/.feed) |
| Dân trí | working | [Publisher](https://dantri.com.vn) (reachable) | [working](https://dantri.com.vn/rss/home.rss) |
| E24 | working | [Publisher](https://e24.no) (reachable) | [working](https://e24.no/rss2/) |
| Echorouk Online | working | [Publisher](https://www.echoroukonline.com) (reachable) | [working](https://www.echoroukonline.com/news-sitemap.xml) |
| EconomyNext | working | [Publisher](https://economynext.com) (reachable) | [working](https://economynext.com/feed/) |
| Egypt Independent | working | [Publisher](https://www.egyptindependent.com) (reachable) | [working](https://www.egyptindependent.com/feed/) |
| Egyptian Streets | working | [Publisher](https://egyptianstreets.com) (reachable) | [working](https://egyptianstreets.com/feed/) |
| El Comercio | working | [Publisher](https://elcomercio.pe) (reachable) | [working](https://elcomercio.pe/arcio/rss/) |
| El Confidencial | external | [Publisher](https://www.elconfidencial.com) (reachable) | No collector configured |
| El Cronista | external | [Publisher](https://www.cronista.com) (reachable) | No collector configured |
| El Espectador | working | [Publisher](https://www.elespectador.com) (unavailable) | [working](https://www.elespectador.com/arc/outboundfeeds/discover/) |
| El Financiero | working | [Publisher](https://www.elfinanciero.com.mx) (reachable) | [working](https://www.elfinanciero.com.mx/arc/outboundfeeds/rss/?outputType=xml) |
| El Khabar | working | [Publisher](https://www.elkhabar.com) (reachable) | [working](https://www.elkhabar.com/feed) |
| El Mostrador | working | [Publisher](https://www.elmostrador.cl) (reachable) | [working](https://www.elmostrador.cl/sitemap_news.xml) |
| El Mundo | working | [Publisher](https://www.elmundo.es) (reachable) | [working](https://www.elmundo.es/rss/googlenews/portada.xml) |
| El Observador | external | [Publisher](https://www.elobservador.com.uy) (blocked) | No collector configured |
| El País | external | [Publisher](https://www.elpais.com.uy) (blocked) | No collector configured |
| El País | working | [Publisher](https://elpais.com) (reachable) | [working](https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada) |
| El Tiempo | working | [Publisher](https://www.eltiempo.com) (reachable) | [working](https://www.eltiempo.com/rss/colombia.xml) |
| El Universal | working | [Publisher](https://www.eluniversal.com.mx) (reachable) | [working](https://www.eluniversal.com.mx/arc/outboundfeeds/news/?outputType=xml) |
| El Watan | external | [Publisher](https://www.elwatan-dz.com) (unavailable) | No collector configured |
| elDiario.es | working | [Publisher](https://www.eldiario.es) (reachable) | [working](https://www.eldiario.es/rss/) |
| Emarat Al Youm | working | [Publisher](https://www.emaratalyoum.com) (reachable) | [working](https://www.emaratalyoum.com/news-sitemaps-1.368006/local-section-1.1075475?ot=ot.AjaxPageLayout) |
| EMOL | external | [Publisher](https://www.emol.com) (reachable) | No collector configured |
| En Perspectiva | working | [Publisher](https://enperspectiva.uy) (reachable) | [working](https://enperspectiva.uy/feed/) |
| English News CN | external | [Publisher](https://english.news.cn) (unavailable) | No collector configured |
| Ethiopian Monitor | external | [Publisher](https://ethiopianmonitor.com) (reachable) | No collector configured |
| Ethiopian News Agency | external | [Publisher](https://www.ena.et) (reachable) | No collector configured |
| ETtoday | external | [Publisher](https://www.ettoday.net) (unavailable) | No collector configured |
| EWN | external | [Publisher](https://ewn.co.za) (reachable) | No collector configured |
| Expansión | external | [Publisher](https://expansion.mx) (blocked) | No collector configured |
| Expressen | working | [Publisher](https://www.expressen.se) (reachable) | [working](https://www.expressen.se/googlenews) |
| Fana Broadcasting | external | [Publisher](https://fanabc.com) (reachable) | No collector configured |
| Fana Media Corporation | working | [Publisher](https://www.fanamc.com/english) (reachable) | [working](https://www.fanamc.com/english/feed/) |
| FAZ | working | [Publisher](https://www.faz.net) (reachable) | [working](https://www.faz.net/rss/aktuell/) |
| FD (Het Financieele Dagblad) | working | [Publisher](https://fd.nl) (reachable) | [working](https://fd.nl?rss) |
| Federal Reserve | working | [Publisher](https://www.federalreserve.gov/) (reachable) | [working](https://www.federalreserve.gov/feeds/speeches.xml); [working](https://www.federalreserve.gov/feeds/press_all.xml) |
| Financial Post | working | [Publisher](https://financialpost.com) (reachable) | [working](https://financialpost.com/feed/atom) |
| Financial Times | working | [Publisher](https://www.ft.com/) (blocked) | [working](https://www.ft.com/rss/home); [working](https://www.ft.com/markets?format=rss); [working](https://www.ft.com/world?format=rss) |
| Financial Tribune | external | [Publisher](https://financialtribune.com) (reachable) | No collector configured |
| Focus Taiwan | external | [Publisher](https://focustaiwan.tw) (reachable) | No collector configured |
| France 24 | working | [Publisher](https://www.france24.com) (reachable) | [working](https://www.france24.com/sitemaps/fr/news.xml) |
| Free Malaysia Today | working | [Publisher](https://www.freemalaysiatoday.com) (reachable) | [working](https://www.freemalaysiatoday.com/feed/) |
| FTV News | external | [Publisher](https://www.ftvnews.com.tw) (unavailable) | No collector configured |
| G4Media | external | [Publisher](https://www.g4media.ro) (blocked) | No collector configured |
| Gazeta Wyborcza | working | [Publisher](https://wyborcza.pl) (reachable) | [working](https://wyborcza.pl/pub/rss/najnowsze_wyborcza.xml) |
| Geo News | working | [Publisher](https://www.geo.tv) (reachable) | [working](https://www.geo.tv/assets/uploads/google_news_latest.xml) |
| Gestión | working | [Publisher](https://gestion.pe) (reachable) | [working](https://gestion.pe/arcio/rss/) |
| Ghana News Agency | external | [Publisher](https://gna.org.gh) (reachable) | No collector configured |
| GhanaWeb | external | [Publisher](https://www.ghanaweb.com) (reachable) | No collector configured |
| Global News | working | [Publisher](https://globalnews.ca) (reachable) | [working](https://globalnews.ca/feed/) |
| Global Times | working | [Publisher](https://www.globaltimes.cn) (reachable) | [working](https://www.globaltimes.cn) |
| GMA News Online | working | [Publisher](https://www.gmanetwork.com/news) (blocked) | [working](https://data.gmanetwork.com/gno/rss/news/feed.xml) |
| Graphic Online | working | [Publisher](https://www.graphic.com.gh) (reachable) | [working](https://www.graphic.com.gh/component/osmap/?view=xml&id=1&news=1&format=xml) |
| Gulf Daily News | working | [Publisher](https://www.gdnonline.com) (reachable) | [working](https://www.gdnonline.com/index.html) |
| Gulf News | working | [Publisher](https://gulfnews.com) (reachable) | [working](https://gulfnews.com/news_sitemap.xml) |
| Gulf Times | working | [Publisher](https://www.gulf-times.com) (reachable) | [working](https://www.gulf-times.com) |
| Haaretz | working | [Publisher](https://www.haaretz.com) (reachable) | [working](https://www.haaretz.com/news-sitemap-content.xml) |
| HabariLeo | working | [Publisher](https://habarileo.co.tz) (reachable) | [working](https://habarileo.co.tz/feed/) |
| Hamshahri Online | working | [Publisher](https://www.hamshahrionline.ir) (reachable) | [working](https://www.hamshahrionline.ir/rss) |
| Handelsblatt | working | [Publisher](https://www.handelsblatt.com) (reachable) | [working](https://www.handelsblatt.com/sitemapExternal/news.xml) |
| Helsingin Sanomat | working | [Publisher](https://www.hs.fi) (reachable) | [working](https://www.hs.fi/rss/custom/news-sitemap.xml) |
| Helsinki Times | working | [Publisher](https://www.helsinkitimes.fi) (reachable) | [working](https://www.helsinkitimes.fi/?format=feed&type=rss) |
| Hespress | working | [Publisher](https://hespress.com) (reachable) | [working](https://www.hespress.com/sitemap-news.xml) |
| Hindustan Times | working | [Publisher](https://www.hindustantimes.com) (reachable) | [working](https://www.hindustantimes.com/feeds/rss/sports/rssfeed.xml) |
| HotNews | working | [Publisher](https://hotnews.ro) (reachable) | [working](https://hotnews.ro/feed) |
| Hromadske | external | [Publisher](https://hromadske.ua) (blocked) | No collector configured |
| Huanqiu | external | [Publisher](https://www.huanqiu.com) (reachable) | No collector configured |
| Hufvudstadsbladet | working | [Publisher](https://hbl.fi) (reachable) | [working](https://www.hbl.fi/feeds/feed.xml) |
| HVG | external | [Publisher](https://hvg.hu) (blocked) | No collector configured |
| Hürriyet Daily News | working | [Publisher](https://www.hurriyetdailynews.com) (reachable) | [working](https://www.hurriyetdailynews.com/sitemaps/newssitemap.xml) |
| IDL-Reporteros | working | [Publisher](https://www.idl-reporteros.pe) (reachable) | [working](https://www.idl-reporteros.pe/feed/) |
| iDNES | working | [Publisher](https://www.idnes.cz) (reachable) | [working](https://servis.idnes.cz/rss.aspx) |
| iHNed | external | [Publisher](https://ihned.cz) (unavailable) | No collector configured |
| Il Giornale | working | [Publisher](https://www.ilgiornale.it) (reachable) | [working](https://www.ilgiornale.it/arc/outboundfeeds/sitemap-news/latest/) |
| Il Post | external | [Publisher](https://www.ilpost.it) (reachable) | No collector configured |
| Il Sole 24 Ore | external | [Publisher](https://www.ilsole24ore.com) (reachable) | No collector configured |
| Ilta-Sanomat | working | [Publisher](https://www.is.fi) (reachable) | [working](https://www.is.fi/rss/custom/news-sitemap.xml) |
| Iltalehti | working | [Publisher](https://www.iltalehti.fi) (reachable) | [working](https://www.iltalehti.fi/rss.xml) |
| Index | working | [Publisher](https://index.hu) (reachable) | [working](https://index.hu/24ora/rss/) |
| Infobae | working | [Publisher](https://www.infobae.com) (reachable) | [working](https://www.infobae.com/arc/outboundfeeds/news-sitemap2/) |
| Information | working | [Publisher](https://information.dk) (reachable) | [working](https://www.information.dk/feed) |
| Interfax-Ukraine | working | [Publisher](https://en.interfax.com.ua) (reachable) | [working](https://en.interfax.com.ua/news/last.rss) |
| Investing Indonesia | working | [Publisher](https://id.investing.com/news) (blocked) | [working](https://id.investing.com/rss/news.rss) |
| Investing.com | working | [Publisher](https://www.investing.com/) (blocked) | [working](https://www.investing.com/rss/news.rss) |
| IOL | working | [Publisher](https://www.iol.co.za) (reachable) | [working](https://iol.co.za/rss/) |
| IPP Media | external | [Publisher](https://ippmedia.com) (blocked) | No collector configured |
| Iraq Business News | working | [Publisher](https://www.iraq-businessnews.com) (reachable) | [working](https://www.iraq-businessnews.com/feed/) |
| Iraqi News Agency | working | [Publisher](https://ina.iq/eng) (reachable) | [working](https://ina.iq/rssdzen.xml) |
| Irish Examiner | working | [Publisher](https://www.irishexaminer.com) (reachable) | [working](https://www.irishexaminer.com/feed/35-top_news.xml) |
| Irish Independent | working | [Publisher](https://www.independent.ie) (blocked) | [working](https://www.independent.ie/rss) |
| IRNA | external | [Publisher](https://en.irna.ir) (unavailable) | No collector configured |
| iROZHLAS | working | [Publisher](https://www.irozhlas.cz) (blocked) | [working](https://www.irozhlas.cz/rss/irozhlas) |
| ISNA | working | [Publisher](https://en.isna.ir) (reachable) | [working](https://en.isna.ir/rss) |
| JO24 | working | [Publisher](https://jo24.net) (reachable) | [working](https://jo24.net/rss.xml) |
| JoongAng Ilbo | external | [Publisher](https://joongang.co.kr) (reachable) | No collector configured |
| Jordan News | working | [Publisher](https://www.jordannews.jo) (reachable) | [working](https://www.jordannews.jo) |
| Jyllands-Posten | external | [Publisher](https://jyllands-posten.dk) (reachable) | No collector configured |
| Katadata | external | [Publisher](https://katadata.co.id) (unavailable) | No collector configured |
| Kauppalehti | external | [Publisher](https://www.kauppalehti.fi) (reachable) | No collector configured |
| KBC | working | [Publisher](https://www.kbc.co.ke) (reachable) | [working](https://www.kbc.co.ke/feed/) |
| KBS News | external | [Publisher](https://kbs.co.kr) (reachable) | No collector configured |
| Kementerian Keuangan | no_parsed_headlines | [Publisher](https://www.kemenkeu.go.id/informasi-publik/publikasi/berita-utama) (reachable) | [no_parsed_headlines](https://www.kemenkeu.go.id/informasi-publik/publikasi/berita-utama) |
| KFM Uganda | working | [Publisher](https://www.kfm.co.ug) (reachable) | [working](https://www.kfm.co.ug/feed/) |
| Khaleej Times | working | [Publisher](https://www.khaleejtimes.com) (reachable) | [working](https://www.khaleejtimes.com/api/v1/collections/top-section.rss) |
| Khaosod | working | [Publisher](https://www.khaosod.co.th) (reachable) | [working](https://www.khaosod.co.th/feed/) |
| Klassekampen | external | [Publisher](https://klassekampen.no) (reachable) | No collector configured |
| Kompas Money | working | [Publisher](https://money.kompas.com/) (reachable) | [working](https://money.kompas.com/) |
| Kontan | working | [Publisher](https://www.kontan.co.id/) (reachable) | [working](https://www.kontan.co.id/) |
| Koran Tempo | external | [Publisher](https://koran.tempo.co) (unavailable) | No collector configured |
| Kronen Zeitung | working | [Publisher](https://www.krone.at) (reachable) | [working](https://api.krone.at/v1/rss/rssfeed-google.xml?id=2311992) |
| Kurier | external | [Publisher](https://kurier.at) (blocked) | No collector configured |
| Kuwait Times | working | [Publisher](https://kuwaittimes.com) (reachable) | [working](https://kuwaittimes.com) |
| Kyodo News | working | [Publisher](https://english.kyodonews.net) (reachable) | [working](https://english.kyodonews.net/list/feed/rss4kyodonews-fzone) |
| L'Express | working | [Publisher](https://www.lexpress.fr) (reachable) | [working](https://www.lexpress.fr/arc/outboundfeeds/rss/alaune.xml) |
| L'Expression | external | [Publisher](https://www.lexpressiondz.com) (blocked) | No collector configured |
| la diaria | working | [Publisher](https://ladiaria.com.uy) (reachable) | [working](https://ladiaria.com.uy/feeds/articulos/) |
| La Jornada | working | [Publisher](https://www.jornada.com.mx) (blocked) | [working](https://www.jornada.com.mx/rss/edicion.xml) |
| La Nación | working | [Publisher](https://www.lanacion.com.ar) (reachable) | [working](https://www.lanacion.com.ar/arc/outboundfeeds/rss/) |
| La Nación | working | [Publisher](https://www.nacion.com) (reachable) | [working](https://www.nacion.com/arc/outboundfeeds/rss/?outputType=xml) |
| La Repubblica | external | [Publisher](https://www.repubblica.it) (blocked) | No collector configured |
| La República | external | [Publisher](https://www.larepublica.co) (unavailable) | No collector configured |
| La República | working | [Publisher](https://larepublica.pe) (reachable) | [working](https://larepublica.pe/rss/home.xml) |
| La República CR | working | [Publisher](https://www.larepublica.net) (reachable) | [working](https://www.larepublica.net/feeds/feed.rss) |
| La Stampa | working | [Publisher](https://www.lastampa.it) (reachable) | [working](https://www.lastampa.it/rss/copertina.xml) |
| La Tercera | external | [Publisher](https://www.latercera.com) (reachable) | No collector configured |
| La Vanguardia | working | [Publisher](https://www.lavanguardia.com) (reachable) | [working](https://www.lavanguardia.com/rss/home.xml) |
| Lao Động | external | [Publisher](https://laodong.vn) (reachable) | No collector configured |
| LBCI News | working | [Publisher](https://www.lbcgroup.tv/news) (reachable) | [working](https://www.lbcgroup.tv/news) |
| Le Figaro | working | [Publisher](https://www.lefigaro.fr) (reachable) | [working](https://www.lefigaro.fr/sitemap_news.xml) |
| Le Matin | working | [Publisher](https://www.lematin.ch) (reachable) | [working](https://www.lematin.ch/sitemaps/fr/news.xml) |
| Le Matin | external | [Publisher](https://lematin.ma) (blocked) | No collector configured |
| Le Monde | working | [Publisher](https://www.lemonde.fr) (reachable) | [working](https://www.lemonde.fr/rss/une.xml) |
| Le Temps | external | [Publisher](https://www.letemps.ch) (reachable) | No collector configured |
| Le360 | working | [Publisher](https://le360.ma) (reachable) | [working](https://fr.le360.ma/arc/outboundfeeds/sitemap-news/) |
| Les Echos | external | [Publisher](https://www.lesechos.fr) (blocked) | No collector configured |
| Les Inspirations ÉCO | working | [Publisher](https://leseco.ma) (reachable) | [working](https://leseco.ma/feed/) |
| Lianhe Zaobao | external | [Publisher](https://www.zaobao.com.sg) (reachable) | No collector configured |
| Libertatea | working | [Publisher](https://www.libertatea.ro) (reachable) | [working](https://www.libertatea.ro/feed) |
| Liberty Times Net | working | [Publisher](https://news.ltn.com.tw) (reachable) | [working](https://news.ltn.com.tw/sitemap.xml) |
| Liberté | working | [Publisher](https://www.liberte-algerie.com) (reachable) | [working](https://www.liberte-algerie.com/feed) |
| Libération | working | [Publisher](https://www.liberation.fr) (blocked) | [working](https://www.liberation.fr/arc/outboundfeeds/sitemap_news.xml?outputType=xml) |
| Livemint | working | [Publisher](https://www.livemint.com) (reachable) | [working](https://www.livemint.com/rss/companies) |
| L’Orient Today | working | [Publisher](https://today.lorientlejour.com) (reachable) | [working](https://today.lorientlejour.com) |
| L’Orient-Le Jour | working | [Publisher](https://www.lorientlejour.com) (reachable) | [working](https://www.lorientlejour.com) |
| Magyar Hang | working | [Publisher](https://hang.hu) (reachable) | [working](https://hang.hu/rss/) |
| Mail & Guardian | working | [Publisher](https://mg.co.za) (reachable) | [working](https://mg.co.za/atom/) |
| Mainichi Shimbun | working | [Publisher](https://mainichi.jp) (reachable) | [working](https://mainichi.jp/rss/etc/mainichi-flash.rss) |
| Malay Mail | working | [Publisher](https://www.malaymail.com) (reachable) | [working](https://www.malaymail.com/feed/rss/malaysia) |
| Malaysiakini | working | [Publisher](https://www.malaysiakini.com) (reachable) | [working](https://www.malaysiakini.com/rss/en/news.rss) |
| Manila Bulletin | external | [Publisher](https://mb.com.ph) (blocked) | No collector configured |
| MAP News | external | [Publisher](https://www.mapnews.ma) (blocked) | No collector configured |
| MarketWatch | working | [Publisher](https://www.marketwatch.com) (blocked) | [working](https://feeds.content.dowjones.io/public/rss/mw_topstories) |
| Matichon | working | [Publisher](https://www.matichon.co.th) (reachable) | [working](https://www.matichon.co.th/feed) |
| Mediapart | working | [Publisher](https://www.mediapart.fr) (reachable) | [working](https://www.mediapart.fr/news_sitemap_editor_choice.xml) |
| Medios Públicos | external | [Publisher](https://mediospublicos.uy) (reachable) | No collector configured |
| Mehr News Agency | working | [Publisher](https://en.mehrnews.com) (reachable) | [working](https://en.mehrnews.com/rss) |
| Milenio | external | [Publisher](https://www.milenio.com) (blocked) | No collector configured |
| Millard Ayo | external | [Publisher](https://millardayo.com) (reachable) | No collector configured |
| Montevideo Portal | working | [Publisher](https://www.montevideo.com.uy) (reachable) | [working](https://www.montevideo.com.uy/anxml.aspx?59) |
| Morocco World News | external | [Publisher](https://www.moroccoworldnews.com) (reachable) | No collector configured |
| Mothership | external | [Publisher](https://mothership.sg) (reachable) | No collector configured |
| Mtanzania | external | [Publisher](https://mtanzania.co.tz) (unavailable) | No collector configured |
| Mubasher Egypt | external | [Publisher](https://mubasher.info/countries/eg) (blocked) | No collector configured |
| Muscat Daily | working | [Publisher](https://muscatdaily.com) (reachable) | [working](https://www.muscatdaily.com) |
| Mwananchi | working | [Publisher](https://www.mwananchi.co.tz) (reachable) | [working](https://www.mwananchi.co.tz) |
| MyJoyOnline | working | [Publisher](https://www.myjoyonline.com) (reachable) | [working](https://www.myjoyonline.com/feed/) |
| Médias24 | external | [Publisher](https://medias24.com) (blocked) | No collector configured |
| National Post | working | [Publisher](https://nationalpost.com) (reachable) | [working](https://nationalpost.com/sitemap-news.xml) |
| NBR | external | [Publisher](https://www.nbr.co.nz) (reachable) | No collector configured |
| NDTV | external | [Publisher](https://www.ndtv.com) (blocked) | No collector configured |
| New Age | external | [Publisher](https://www.newagebd.net) (blocked) | No collector configured |
| New Straits Times | external | [Publisher](https://www.nst.com.my) (reachable) | No collector configured |
| New Vision | external | [Publisher](https://www.newvision.co.ug) (unavailable) | No collector configured |
| News First | external | [Publisher](https://www.newsfirst.lk) (reachable) | No collector configured |
| News of Bahrain | working | [Publisher](https://www.newsofbahrain.com) (reachable) | [working](https://www.newsofbahrain.com/en) |
| News.com.au | external | [Publisher](https://www.news.com.au) (blocked) | No collector configured |
| News24 | external | [Publisher](https://www.news24.com) (reachable) | No collector configured |
| Newshub | external | [Publisher](https://www.newshub.co.nz) (reachable) | No collector configured |
| Newsroom | working | [Publisher](https://www.newsroom.co.nz) (reachable) | [working](https://newsroom.co.nz/feed/) |
| NHK News | external | [Publisher](https://www.nhk.or.jp) (reachable) | No collector configured |
| Nhân Dân | external | [Publisher](https://nhandan.vn) (reachable) | No collector configured |
| Nikkei | external | [Publisher](https://www.nikkei.com) (reachable) | No collector configured |
| Nile Post | working | [Publisher](https://nilepost.co.ug) (reachable) | [working](https://nilepost.co.ug/news-sitemap.xml) |
| NOS | working | [Publisher](https://nos.nl) (reachable) | [working](https://feeds.nos.nl/nosnieuwsalgemeen) |
| Notes From Poland | working | [Publisher](https://notesfrompoland.com) (reachable) | [working](https://notesfrompoland.com/feed/) |
| Noticias Caracol | external | [Publisher](https://noticias.caracoltv.com) (reachable) | No collector configured |
| Novinky | working | [Publisher](https://www.novinky.cz) (reachable) | [working](https://www.novinky.cz/sitemaps/sitemap_news.xml) |
| NPR | working | [Publisher](https://www.npr.org) (reachable) | [working](https://feeds.npr.org/1001/rss.xml) |
| NRC | working | [Publisher](https://www.nrc.nl) (reachable) | [working](https://www.nrc.nl/rss/) |
| NRK | working | [Publisher](https://www.nrk.no) (reachable) | [working](https://www.nrk.no/toppsaker.rss) |
| NTV | external | [Publisher](https://www.ntv.com.tr) (blocked) | No collector configured |
| NU.nl | working | [Publisher](https://www.nu.nl) (blocked) | [working](https://www.nu.nl/rss/Algemeen) |
| NV | working | [Publisher](https://nv.ua/en) (unavailable) | [working](https://nv.ua/sitemap_v2/news-sitemap.xml) |
| NZZ (Neue Zürcher Zeitung) | working | [Publisher](https://www.nzz.ch) (reachable) | [working](https://www.nzz.ch/recent.rss) |
| OjoPúblico | external | [Publisher](https://ojo-publico.com) (reachable) | No collector configured |
| Oman Daily | working | [Publisher](https://www.omandaily.om) (reachable) | [working](https://www.omandaily.om) |
| Onet | external | [Publisher](https://www.onet.pl) (reachable) | No collector configured |
| ORF | working | [Publisher](https://orf.at) (reachable) | [working](https://rss.orf.at/news.xml) |
| PAP | external | [Publisher](https://www.pap.pl) (unavailable) | No collector configured |
| PBS NewsHour | working | [Publisher](https://www.pbs.org/newshour) (reachable) | [working](https://www.pbs.org/newshour/feeds/rss/headlines) |
| People's Daily | external | [Publisher](https://peoplesdaily.pdnews.cn) (reachable) | No collector configured |
| Perfil | working | [Publisher](https://www.perfil.com) (reachable) | [working](https://www.perfil.com/feed) |
| Perú 21 | external | [Publisher](https://peru21.pe) (reachable) | No collector configured |
| Philippine Daily Inquirer | working | [Publisher](https://www.inquirer.net) (reachable) | [working](https://www.inquirer.net/fullfeed) |
| Pluang | blocked | [Publisher](https://pluang.com/news-feed) (blocked) | [blocked](https://pluang.com/news-feed) |
| Politiken | external | [Publisher](https://politiken.dk) (unavailable) | No collector configured |
| Polityka | working | [Publisher](https://www.polityka.pl) (reachable) | [working](https://www.polityka.pl/rss/articles.xml?list=517) |
| Portafolio | working | [Publisher](https://www.portafolio.co) (reachable) | [working](https://www.portafolio.co/sitemap-google-news.xml) |
| Portfolio | working | [Publisher](https://www.portfolio.hu) (reachable) | [working](https://www.portfolio.hu/rss/all.xml) |
| Premium Times | working | [Publisher](https://www.premiumtimesng.com) (reachable) | [working](https://www.premiumtimesng.com/feed) |
| Press TV | external | [Publisher](https://www.presstv.ir) (reachable) | No collector configured |
| Proceso | external | [Publisher](https://www.proceso.com.mx) (reachable) | No collector configured |
| Profil | external | [Publisher](https://profil.at) (blocked) | No collector configured |
| Prothom Alo | working | [Publisher](https://www.prothomalo.com) (reachable) | [working](https://www.prothomalo.com/news_sitemap.xml) |
| PTS News | external | [Publisher](https://news.pts.org.tw) (unavailable) | No collector configured |
| Pulse Ghana | working | [Publisher](https://www.pulse.com.gh) (reachable) | [working](https://www.pulse.com.gh/rss-articles.xml) |
| Punch Newspapers | working | [Publisher](https://punchng.com) (reachable) | [working](https://punchng.com/feed/) |
| Página 12 | working | [Publisher](https://www.pagina12.com.ar) (reachable) | [working](https://www.pagina12.com.ar/arc/outboundfeeds/rss/portada) |
| Radio Europa Liberă | external | [Publisher](https://romania.europalibera.org) (reachable) | No collector configured |
| Radio Monumental | external | [Publisher](https://www.monumental.co.cr) (blocked) | No collector configured |
| Radio Prague International | working | [Publisher](https://english.radio.cz) (blocked) | [working](https://english.radio.cz/rcz-rss/en) |
| RaiNews | external | [Publisher](https://www.rainews.it) (reachable) | No collector configured |
| Rappler | external | [Publisher](https://www.rappler.com) (reachable) | No collector configured |
| RCN Radio | external | [Publisher](https://www.rcnradio.com) (reachable) | No collector configured |
| Reforma | external | [Publisher](https://www.reforma.com) (blocked) | No collector configured |
| Republika | external | [Publisher](https://republika.co.id) (reachable) | No collector configured |
| Reuters | working | [Publisher](https://www.reuters.com/) (blocked) | [working](https://www.reuters.com/arc/outboundfeeds/news-sitemap/?outputType=xml) |
| RNZ News | working | [Publisher](https://www.rnz.co.nz) (reachable) | [working](https://www.rnz.co.nz/rss/national.xml) |
| Romania Insider | external | [Publisher](https://www.romania-insider.com) (blocked) | No collector configured |
| Roya News | working | [Publisher](https://royanews.tv) (reachable) | [working](https://royanews.tv) |
| RPP Noticias | working | [Publisher](https://rpp.pe) (reachable) | [working](https://rpp.pe/rss) |
| RTS Info | external | [Publisher](https://www.rts.ch/info) (reachable) | No collector configured |
| RTVE Noticias | external | [Publisher](https://www.rtve.es/noticias) (reachable) | No collector configured |
| RTÉ News | working | [Publisher](https://www.rte.ie/news) (reachable) | [working](https://www.rte.ie/feeds/rss/?index=/news/) |
| Rudaw | working | [Publisher](https://www.rudaw.net) (reachable) | [working](https://www.rudaw.net/sorani) |
| Rzeczpospolita | working | [Publisher](https://www.rp.pl) (reachable) | [working](https://www.rp.pl/rss_main) |
| SABC News | working | [Publisher](https://www.sabcnews.com) (unavailable) | [working](https://www.sabcnews.com/sabcnews/feed/) |
| Sabq | working | [Publisher](https://sabq.org) (reachable) | [working](https://sabq.org/api/rss/articles) |
| Salzburger Nachrichten | working | [Publisher](https://www.sn.at) (reachable) | [working](https://www.sn.at/news-artikel.sitemap.xml) |
| Sankei Shimbun | external | [Publisher](https://www.sankei.com) (reachable) | No collector configured |
| Saraya News | working | [Publisher](https://sarayanews.com) (reachable) | [working](https://www.sarayanews.com/) |
| Saudi Gazette | working | [Publisher](https://saudigazette.com.sa) (reachable) | [working](https://saudigazette.com.sa/sitemaps/news_sitemap.xml) |
| SBS News | external | [Publisher](https://www.sbs.com.au/news) (reachable) | No collector configured |
| Scroll.in | working | [Publisher](https://scroll.in) (reachable) | [working](https://scroll.in/sitemap/news-sitemap.xml) |
| Semana | external | [Publisher](https://www.semana.com) (reachable) | No collector configured |
| Semanario Universidad | external | [Publisher](https://semanariouniversidad.com) (reachable) | No collector configured |
| SET News | working | [Publisher](https://www.setn.com) (reachable) | [working](https://www.setn.com/sitemapGoogleNews.xml) |
| Seznam Zprávy | working | [Publisher](https://www.seznamzpravy.cz) (reachable) | [working](https://www.seznamzpravy.cz/sitemaps/sitemap_news.xml) |
| Shorouk News | external | [Publisher](https://www.shorouknews.com) (reachable) | No collector configured |
| Sinar Harian | external | [Publisher](https://www.sinarharian.com.my) (unavailable) | No collector configured |
| SINDOnews Ekbis | working | [Publisher](https://ekbis.sindonews.com/) (reachable) | [working](https://ekbis.sindonews.com/rss) |
| Sky News | working | [Publisher](https://news.sky.com) (blocked) | [working](https://feeds.skynews.com/feeds/rss/home.xml) |
| Somoy News | external | [Publisher](https://en.somoynews.tv) (unavailable) | No collector configured |
| South China Morning Post | working | [Publisher](https://www.scmp.com) (reachable) | [working](https://www.scmp.com/rss/feed) |
| SowetanLIVE | external | [Publisher](https://www.sowetanlive.co.za) (reachable) | No collector configured |
| SRF News | working | [Publisher](https://www.srf.ch/news) (reachable) | [working](https://www.srf.ch/new-news-sitemap) |
| State Information Service | external | [Publisher](https://www.sis.gov.eg) (unavailable) | No collector configured |
| Stocktwits | working | [Publisher](https://stocktwits.com/) (reachable) | [working](https://stocktwits.com/sitemap/rss_feed.xml) |
| Storm Media | external | [Publisher](https://www.storm.mg) (reachable) | No collector configured |
| Stuff | working | [Publisher](https://www.stuff.co.nz) (reachable) | [working](https://www.stuff.co.nz/sitemap/news/sitemap.xml) |
| Subrayado | external | [Publisher](https://subrayado.com.uy) (blocked) | No collector configured |
| Suomen Kuvalehti | external | [Publisher](https://suomenkuvalehti.fi) (reachable) | No collector configured |
| Suspilne News | external | [Publisher](https://suspilne.media) (blocked) | No collector configured |
| Svenska Dagbladet | external | [Publisher](https://www.svd.se) (reachable) | No collector configured |
| Sveriges Radio | external | [Publisher](https://sverigesradio.se) (blocked) | No collector configured |
| SVT Nyheter | working | [Publisher](https://www.svt.se/nyheter) (reachable) | [working](https://www.svt.se/nyheter/rss.xml) |
| SWI swissinfo | working | [Publisher](https://www.swissinfo.ch) (reachable) | [working](https://www.swissinfo.ch/eng/sitemap-news.xml) |
| Sözcü | external | [Publisher](https://www.sozcu.com.tr) (blocked) | No collector configured |
| Süddeutsche Zeitung | external | [Publisher](https://www.sueddeutsche.de) (reachable) | No collector configured |
| T13 | external | [Publisher](https://www.t13.cl) (reachable) | No collector configured |
| T24 | external | [Publisher](https://t24.com.tr) (unavailable) | No collector configured |
| Tages-Anzeiger | working | [Publisher](https://www.tagesanzeiger.ch) (unavailable) | [working](https://www.tagesanzeiger.ch/news.xml) |
| Tagesschau | working | [Publisher](https://www.tagesschau.de) (reachable) | [working](https://www.tagesschau.de/infoservices/alle-meldungen-100~rss2.xml) |
| Taipei Times | no_parsed_headlines | [Publisher](https://www.taipeitimes.com) (reachable) | [no_parsed_headlines](https://www.taipeitimes.com/xml/index.rss) |
| Tamil Murasu | working | [Publisher](https://tamilmurasu.com.sg) (reachable) | [working](https://www.tamilmurasu.com.sg/googlenews.xml) |
| Tasnim News Agency | external | [Publisher](https://www.tasnimnews.com) (unavailable) | No collector configured |
| TBC | external | [Publisher](https://www.tbc.go.tz) (reachable) | No collector configured |
| Tehran Times | working | [Publisher](https://www.tehrantimes.com) (reachable) | [working](https://www.tehrantimes.com/rss) |
| Teledoce | working | [Publisher](https://www.teledoce.com) (reachable) | [working](https://www.teledoce.com/feed/) |
| Teletica | external | [Publisher](https://www.teletica.com) (blocked) | No collector configured |
| Telex | working | [Publisher](https://telex.hu) (reachable) | [working](https://telex.hu/rss) |
| TelQuel | working | [Publisher](https://telquel.ma) (reachable) | [working](https://telquel.ma/feed) |
| Thai PBS | external | [Publisher](https://www.thaipbs.or.th) (reachable) | No collector configured |
| Thairath | external | [Publisher](https://www.thairath.co.th) (reachable) | No collector configured |
| Thanh Niên | working | [Publisher](https://thanhnien.vn) (reachable) | [working](https://thanhnien.vn/rss/home.rss) |
| The Age | working | [Publisher](https://www.theage.com.au) (reachable) | [working](https://www.theage.com.au/rss/feed.xml) |
| The Asahi Shimbun | working | [Publisher](https://www.asahi.com) (unavailable) | [working](https://www.asahi.com/rss/asahi/newsheadlines.rdf) |
| The Australian | external | [Publisher](https://www.theaustralian.com.au) (blocked) | No collector configured |
| The Australian Financial Review | working | [Publisher](https://www.afr.com) (reachable) | [working](https://www.afr.com/sitemaps/news/brands/afr) |
| The Business Standard | working | [Publisher](https://www.tbsnews.net) (reachable) | [working](https://www.tbsnews.net/bangla/googlenews.xml) |
| The Business Times | working | [Publisher](https://www.businesstimes.com.sg) (reachable) | [working](https://www.businesstimes.com.sg/googlenews.xml) |
| The Chosun Ilbo | working | [Publisher](https://www.chosun.com) (reachable) | [working](https://www.chosun.com/arc/outboundfeeds/news-sitemap/?outputType=xml) |
| The Citizen | working | [Publisher](https://www.thecitizen.co.tz) (reachable) | [working](https://www.thecitizen.co.tz) |
| The Clinic | working | [Publisher](https://www.theclinic.cl) (reachable) | [working](https://www.theclinic.cl/feed/) |
| The Copenhagen Post | working | [Publisher](https://cphpost.dk) (reachable) | [working](https://cphpost.dk/feed/) |
| The Currency | external | [Publisher](https://www.thecurrency.news) (reachable) | No collector configured |
| The Daily Ittefaq | external | [Publisher](https://www.ittefaq.com.bd) (blocked) | No collector configured |
| The Daily Star | external | [Publisher](https://www.thedailystar.net) (blocked) | No collector configured |
| The Dong-A Ilbo | working | [Publisher](https://www.donga.com) (reachable) | [working](https://rss.donga.com/total.xml) |
| The EastAfrican | working | [Publisher](https://www.theeastafrican.co.ke) (blocked) | [working](https://www.theeastafrican.co.ke/rss.xml) |
| The Economic Times | working | [Publisher](https://economictimes.indiatimes.com/) (reachable) | [working](https://economictimes.indiatimes.com/rssfeeds/13352306.cms) |
| The Edge Markets | external | [Publisher](https://theedgemalaysia.com) (reachable) | No collector configured |
| The Edge Singapore | working | [Publisher](https://theedgesingapore.com) (reachable) | [working](https://www.theedgesingapore.com/latest-news-echobox.rss) |
| The Express Tribune | working | [Publisher](https://tribune.com.pk) (reachable) | [working](https://tribune.com.pk/feed/home) |
| The Financial Express | external | [Publisher](https://thefinancialexpress.com.bd) (reachable) | No collector configured |
| The Globe and Mail | external | [Publisher](https://www.theglobeandmail.com) (reachable) | No collector configured |
| The Guardian | working | [Publisher](https://www.theguardian.com/) (reachable) | [working](https://www.theguardian.com/international/rss); [working](https://www.theguardian.com/business/rss); [working](https://www.theguardian.com/politics/rss); [working](https://www.theguardian.com/sport/rss) |
| The Guardian Australia | working | [Publisher](https://www.theguardian.com/australia-news) (reachable) | [working](https://www.theguardian.com/australia-news/rss) |
| The Guardian Nigeria | working | [Publisher](https://guardian.ng) (reachable) | [working](https://guardian.ng/news-sitemap.xml) |
| The Hankyoreh | external | [Publisher](https://www.hani.co.kr) (reachable) | No collector configured |
| The Hindu | working | [Publisher](https://www.thehindu.com) (reachable) | [working](https://www.thehindu.com/news/feeder/default.rss) |
| The Independent | no_parsed_headlines | [Publisher](https://www.independent.co.uk) (reachable) | [no_parsed_headlines](https://www.independent.co.uk/news/rss) |
| The Independent Uganda | external | [Publisher](https://independent.co.ug) (unavailable) | No collector configured |
| The Indian Express | working | [Publisher](https://indianexpress.com) (reachable) | [working](https://indianexpress.com/section/cities/ahmedabad/feed/) |
| The Irish Times | external | [Publisher](https://www.irishtimes.com) (reachable) | No collector configured |
| The Island | external | [Publisher](https://island.lk) (unavailable) | No collector configured |
| The Jakarta Post | working | [Publisher](https://www.thejakartapost.com) (reachable) | [working](https://www.thejakartapost.com/sitemap_news.xml) |
| The Japan Times | working | [Publisher](https://www.japantimes.co.jp) (blocked) | [working](https://www.japantimes.co.jp/feed/) |
| The Jerusalem Post | working | [Publisher](https://www.jpost.com) (reachable) | [working](https://www.jpost.com/rss/rssfeedsfrontpage.aspx) |
| The Korea Herald | working | [Publisher](https://www.koreaherald.com) (reachable) | [working](https://www.koreaherald.com/rss/newsAll) |
| The Korea Times | working | [Publisher](https://www.koreatimes.co.kr) (reachable) | [working](https://www.koreatimes.co.kr/www/rss/nation.xml) |
| The Kyiv Independent | working | [Publisher](https://kyivindependent.com) (reachable) | [working](https://kyivindependent.com/news-archive/rss/) |
| The Local Norway | working | [Publisher](https://www.thelocal.no) (reachable) | [working](https://www.thelocal.no/sitemap/no/news.xml) |
| The Local Sweden | working | [Publisher](https://www.thelocal.se) (reachable) | [working](https://www.thelocal.se/sitemap/se/news.xml) |
| The Manila Times | external | [Publisher](https://www.manilatimes.net) (reachable) | No collector configured |
| The Morning | external | [Publisher](https://www.themorning.lk) (unavailable) | No collector configured |
| The Nation | external | [Publisher](https://thenationonlineng.net) (reachable) | No collector configured |
| The Nation | external | [Publisher](https://nation.com.pk) (reachable) | No collector configured |
| The Nation Thailand | external | [Publisher](https://www.nationthailand.com) (reachable) | No collector configured |
| The National | working | [Publisher](https://www.thenationalnews.com) (reachable) | [working](https://www.thenationalnews.com/arc/outboundfeeds/news-sitemap/?outputType=xml) |
| The New York Times | working | [Publisher](https://www.nytimes.com) (blocked) | [working](https://www.nytimes.com/sitemaps/new/news.xml.gz) |
| The New Zealand Herald | external | [Publisher](https://www.nzherald.co.nz) (reachable) | No collector configured |
| The News International | no_parsed_headlines | [Publisher](https://www.thenews.com.pk) (reachable) | [no_parsed_headlines](https://www.thenews.com.pk/assets/uploads/google_news_latest.xml) |
| The Observer | working | [Publisher](https://observer.ug) (reachable) | [working](https://observer.ug/feed/) |
| The Paper | external | [Publisher](https://www.thepaper.cn) (blocked) | No collector configured |
| The Peninsula Qatar | working | [Publisher](https://thepeninsulaqatar.com) (reachable) | [working](https://thepeninsulaqatar.com) |
| The Philippine Star | working | [Publisher](https://www.philstar.com) (reachable) | [working](https://www.philstar.com/rss/headlines) |
| The Reporter Ethiopia | working | [Publisher](https://www.thereporterethiopia.com) (reachable) | [working](https://www.thereporterethiopia.com/feed/) |
| The Spinoff | working | [Publisher](https://thespinoff.co.nz) (reachable) | [working](https://thespinoff.co.nz) |
| The Standard | working | [Publisher](https://www.standardmedia.co.ke) (reachable) | [working](https://www.standardmedia.co.ke/sitemaps/googlenews.php) |
| THE STANDARD | working | [Publisher](https://thestandard.co) (reachable) | [working](https://thestandard.co/feed/) |
| The Star | working | [Publisher](https://www.thestar.com.my) (reachable) | [working](https://www.thestar.com.my) |
| The Star Kenya | external | [Publisher](https://www.the-star.co.ke) (reachable) | No collector configured |
| The Straits Times | working | [Publisher](https://www.straitstimes.com) (reachable) | [working](https://www.straitstimes.com/googlenews.xml) |
| The Sunday Times Sri Lanka | working | [Publisher](https://www.sundaytimes.lk) (reachable) | [working](https://www.sundaytimes.lk) |
| The Sydney Morning Herald | working | [Publisher](https://www.smh.com.au) (reachable) | [working](https://www.smh.com.au/rss/feed.xml) |
| The Telegraph | external | [Publisher](https://www.telegraph.co.uk) (unavailable) | No collector configured |
| The Tico Times | external | [Publisher](https://ticotimes.net) (reachable) | No collector configured |
| The Times Kuwait | working | [Publisher](https://timeskuwait.com) (reachable) | [working](https://timeskuwait.com/feed/) |
| The Times of India | external | [Publisher](https://timesofindia.indiatimes.com) (reachable) | No collector configured |
| The Times of Israel | working | [Publisher](https://www.timesofisrael.com) (blocked) | [working](https://www.timesofisrael.com/news-sitemap.xml) |
| The Times UK | working | [Publisher](https://www.thetimes.com) (reachable) | [working](https://www.thetimes.com/sitemaps/news) |
| The Wall Street Journal | working | [Publisher](https://www.wsj.com/) (blocked) | [working](https://feeds.content.dowjones.io/public/rss/RSSWorldNews); [working](https://feeds.content.dowjones.io/public/rss/WSJcomUSBusiness); [working](https://feeds.content.dowjones.io/public/rss/RSSMarketsMain); [working](https://feeds.content.dowjones.io/public/rss/socialpoliticsfeed); [working](https://feeds.content.dowjones.io/public/rss/rsssportsfeed) |
| The Washington Post | external | [Publisher](https://www.washingtonpost.com) (unavailable) | No collector configured |
| The Wire | external | [Publisher](https://thewire.in) (reachable) | No collector configured |
| The Yomiuri Shimbun | external | [Publisher](https://www.yomiuri.co.jp) (reachable) | No collector configured |
| TheJournal.ie | working | [Publisher](https://www.thejournal.ie) (reachable) | [working](https://www.thejournal.ie/feed/) |
| THISDAYLIVE | working | [Publisher](https://www.thisdaylive.com) (reachable) | [working](https://www.thisdaylive.com/index.php/feed/) |
| Times of Oman | working | [Publisher](https://timesofoman.com) (reachable) | [working](https://timesofoman.com) |
| TimesLIVE | working | [Publisher](https://www.timeslive.co.za) (reachable) | [working](https://www.timeslive.co.za/arc/outboundfeeds/rss/) |
| Tirto | working | [Publisher](https://tirto.id) (reachable) | [working](https://tirto.id/sitemap/r/google-discover) |
| Today Online | external | [Publisher](https://www.todayonline.com) (reachable) | No collector configured |
| Toronto Star | external | [Publisher](https://www.thestar.com) (reachable) | No collector configured |
| Trade With FNC | unavailable | [Publisher](https://tradewithfnc.com/) (reachable) | [unavailable](https://tradewithfnc.com/berita.json) |
| Trouw | external | [Publisher](https://www.trouw.nl) (blocked) | No collector configured |
| TRT Haber | working | [Publisher](https://www.trthaber.com) (reachable) | [working](https://www.trthaber.com/sondakika.rss) |
| TSA Algérie | working | [Publisher](https://www.tsa-algerie.com) (reachable) | [working](https://www.tsa-algerie.com/feed/) |
| TT Nyhetsbyrån | external | [Publisher](https://tt.se) (reachable) | No collector configured |
| Tuổi Trẻ | working | [Publisher](https://tuoitre.vn) (reachable) | [working](https://tuoitre.vn/home.rss) |
| TV 2 Nyheder | external | [Publisher](https://nyheder.tv2.dk) (reachable) | No collector configured |
| TVBS News | working | [Publisher](https://news.tvbs.com.tw) (reachable) | [working](https://news.tvbs.com.tw/sitemap/news-sitemap) |
| TVN24 | external | [Publisher](https://tvn24.pl) (reachable) | No collector configured |
| Télam | external | [Publisher](https://www.telam.com.ar) (unavailable) | No collector configured |
| Uganda Radio Network | external | [Publisher](https://ugandaradionetwork.net) (blocked) | No collector configured |
| Ukrayinska Pravda | external | [Publisher](https://www.pravda.com.ua) (blocked) | No collector configured |
| Ukrinform | external | [Publisher](https://www.ukrinform.net) (reachable) | No collector configured |
| United Daily News | working | [Publisher](https://udn.com) (reachable) | [working](https://udn.com/news/rssfeed) |
| Vanguard | external | [Publisher](https://www.vanguardngr.com) (unavailable) | No collector configured |
| VG | working | [Publisher](https://www.vg.no) (reachable) | [working](https://www.vg.no/rss/feed/?format=rss) |
| VietNamNet | working | [Publisher](https://vietnamnet.vn) (reachable) | [working](https://vietnamnet.vn/sitemap-news.xml) |
| VietnamPlus | external | [Publisher](https://en.vietnamplus.vn) (reachable) | No collector configured |
| VnExpress | working | [Publisher](https://vnexpress.net) (reachable) | [working](https://vnexpress.net/rss/tin-moi-nhat.rss) |
| Walta TV | external | [Publisher](https://waltainfo.com) (reachable) | No collector configured |
| Wiener Zeitung | working | [Publisher](https://www.wienerzeitung.at) (reachable) | [working](https://www.wienerzeitung.at/rss.xml) |
| Xinhua News | external | [Publisher](https://www.xinhuanet.com) (unavailable) | No collector configured |
| Yabiladi | external | [Publisher](https://en.yabiladi.com) (blocked) | No collector configured |
| Yahoo Finance | working | [Publisher](https://finance.yahoo.com/) (reachable) | [working](https://finance.yahoo.com/) |
| Yle | working | [Publisher](https://yle.fi) (reachable) | [working](https://feeds.yle.fi/uutiset/v1/recent.rss?publisherIds=YLE_NEWS) |
| Ynetnews | working | [Publisher](https://www.ynetnews.com) (reachable) | [working](https://www.ynetnews.com/category/3083) |
| Yonhap News Agency | working | [Publisher](https://en.yna.co.kr) (reachable) | [working](https://en.yna.co.kr/news-sitemap.xml) |
| Youm7 | external | [Publisher](https://www.youm7.com) (reachable) | No collector configured |
| Ámbito Financiero | external | [Publisher](https://www.ambito.com) (blocked) | No collector configured |
| ČT24 | working | [Publisher](https://ct24.ceskatelevize.cz) (reachable) | [working](https://ct24.ceskatelevize.cz/sitemaps/sitemap_news.xml) |
| Știrile Pro TV | external | [Publisher](https://stirileprotv.ro) (blocked) | No collector configured |
