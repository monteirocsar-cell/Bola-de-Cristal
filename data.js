// Base de rampas de voo livre do Sudeste do Brasil.
// category 'full'   -> coordenadas confiáveis o bastante para previsão detalhada ao vivo
// category 'ref'     -> ficha técnica de referência (coordenadas aproximadas do município/região)
// coordsApprox: true quando a coordenada é aproximada (centro da cidade / estimativa), não o ponto exato da rampa.

const SITES = [
  {
    id:'marataizes', name:'Marataizes — Restinga/Dunas', city:'Marataizes', state:'ES',
    lat:-21.0447, lon:-40.8256, altitude:5, coordsApprox:false, category:'full',
    quadrants:['E','ENE'],
    note:'Rampa de dunas costeiras ao nível do mar, decolagem voltada para o mar (E/ENE). Ponto usado localmente, fora dos catálogos oficiais.'
  },
  {
    id:'alfredochaves', name:'Rampa de Cachoeira Alta', city:'Alfredo Chaves', state:'ES',
    lat:-20.6389, lon:-40.7442, altitude:null, coordsApprox:true, category:'full',
    quadrants:['N','NE','E','SE','S'],
    note:'~86 km de Vitória, no distrito de Cachoeira Alta. Aceita vários quadrantes de vento. Coordenada aproximada (sede do distrito) — confirme o acesso exato com a associação local.'
  },
  {
    id:'niteroi', name:'Parque da Cidade', city:'Niterói', state:'RJ',
    lat:-22.929896, lon:-43.087832, altitude:270, coordsApprox:false, category:'full',
    quadrants:['N','NE','S','SE','NW'],
    note:'Duas rampas de concreto: uma para NW/N/NE (pouso em Charitas) e outra para S/SE (pouso em Piratininga). A rampa SE exige nível intermediário/avançado. Recorde de distância: 125 km.'
  },
  {
    id:'ibituruna', name:'Pico do Ibituruna', city:'Governador Valadares', state:'MG',
    lat:-18.8531, lon:-41.9853, altitude:1123, coordsApprox:true, category:'full',
    quadrants:['E','ENE'],
    note:'Um dos points mais tradicionais do voo livre no Brasil — "capital mundial do voo livre". Coordenada aproximada do topo do pico.'
  },
  {
    id:'altomorin', name:'Rampa do Alto Morin', city:'Petrópolis', state:'RJ',
    lat:-22.4930, lon:-43.1729, altitude:1450, coordsApprox:true, category:'full',
    quadrants:['N','NW','S'],
    note:'Uma das rampas mais altas do estado do RJ. Acesso pelo Alto da Serra, estrada íngreme e malconservada — 4x4 recomendado. Coordenada aproximada.'
  },
  {
    id:'atibaia', name:'Rampa da Pedra Grande', city:'Atibaia', state:'SP',
    lat:-23.168711, lon:-46.528709, altitude:1382, coordsApprox:false, category:'full',
    quadrants:['N','NE','NW'],
    note:'Dentro do Parque Estadual de Itapetinga, 75 km de São Paulo. Pouso oficial no bairro Flamboyant, ~4 km da rampa. Recorde de asa-delta: 145,8 km. Portão fecha às 18h.'
  },
  {
    id:'pedradobau', name:'Rampa da Pedra do Baú', city:'São Bento do Sapucaí', state:'SP',
    lat:-22.6892, lon:-45.7328, altitude:null, coordsApprox:true, category:'ref',
    quadrants:['N','NE','NW'],
    note:'~205 km de São Paulo, 26 km de Campos do Jordão. Acesso via Campos do Jordão (bairro Jaguaribe) ou via São Bento do Sapucaí (estrada do Paiol Grande). Voo de encosta, térmica e cross-country.'
  },
  {
    id:'pocosdecaldas', name:'Rampa do Cristo', city:'Poços de Caldas', state:'MG',
    lat:-21.7877, lon:-46.5613, altitude:null, coordsApprox:true, category:'ref',
    quadrants:['N','NE','NW'],
    note:'270 km de São Paulo, 450 km de BH. Acesso pavimentado (~5 km do centro) ou por teleférico. Cross-country, encosta e térmica.'
  },
  {
    id:'baixoguandu', name:'Rampa da Pedra da Galinha', city:'Baixo Guandu', state:'ES',
    lat:-19.5189, lon:-41.0166, altitude:null, coordsApprox:true, category:'ref',
    quadrants:['N','NE','NW','W'],
    note:'Acesso pela ES-165 sentido Ibituba, até Barra do Santa Rosa, subida de ~9 km (4x4 recomendado em época de chuva).'
  },
  {
    id:'pedraazul', name:'Região da Pedra Azul', city:'Domingos Martins', state:'ES',
    lat:-20.3622, lon:-41.0819, altitude:null, coordsApprox:true, category:'ref',
    quadrants:[],
    note:'Região serrana turística com atividade de voo livre conhecida; dados técnicos da(s) rampa(s) ainda não confirmados nesta versão — consulte a associação capixaba de voo livre antes de ir.'
  },
  {
    id:'picogaviao', name:'Pico do Gavião', city:'Andradas (MG) / Águas da Prata (SP)', state:'MG',
    lat:-22.0666, lon:-46.5717, altitude:null, coordsApprox:true, category:'ref',
    quadrants:[],
    note:'Rampa na divisa MG/SP. Ficha técnica ainda incompleta nesta versão.'
  },
  {
    id:'castelo', name:'Rampa de Córrego de Ubá', city:'Castelo', state:'ES',
    lat:-20.5997, lon:-41.1852, altitude:null, coordsApprox:true, category:'ref',
    quadrants:[],
    note:'Ficha técnica ainda incompleta nesta versão — confirme acesso e quadrante de vento com a associação local.'
  },
  {
    id:'mombaca', name:'Rampa de Mombaça', city:'Angra dos Reis', state:'RJ',
    lat:-23.0067, lon:-44.3181, altitude:null, coordsApprox:true, category:'ref',
    quadrants:[],
    note:'Ficha técnica ainda incompleta nesta versão.'
  },
  {
    id:'rioclaro', name:'Rampa do Lima', city:'Rio Claro', state:'RJ',
    lat:-22.7136, lon:-44.1400, altitude:null, coordsApprox:true, category:'ref',
    quadrants:[],
    note:'Ficha técnica ainda incompleta nesta versão.'
  },
  {
    id:'saopedro', name:'Rampa de São Pedro', city:'São Pedro', state:'SP',
    lat:-22.5453, lon:-47.9134, altitude:null, coordsApprox:true, category:'ref',
    quadrants:[],
    note:'Ponto tradicional e bastante procurado por iniciantes e voo duplo. Ficha técnica detalhada ainda não incluída nesta versão.'
  },
];
