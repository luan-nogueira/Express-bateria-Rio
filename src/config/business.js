/**
 * Fonte única dos dados comerciais da Express Baterias Rio.
 *
 * Tudo aqui foi informado pela empresa (briefing + site atual) ou é um link
 * público verificado. Ao mudar algo (telefone, nota no Google, promessas
 * comerciais), altere SOMENTE este arquivo — o HTML estático que repete
 * esses dados para SEO está listado em README.md › "Dados comerciais".
 */

export const business = {
  name: 'Express Baterias Rio',
  legalName: 'Express Baterias e Acessórios',
  url: 'https://expressbateriasrio.com.br/',

  phone: {
    e164: '+5521999404005',
    display: '(21) 99940-4005',
  },
  whatsapp: {
    number: '5521999404005', // formato exigido pelo wa.me: DDI + DDD + número, só dígitos
  },

  address: {
    street: 'Rua General Polidoro, 308',
    district: 'Botafogo',
    city: 'Rio de Janeiro',
    state: 'RJ',
    postalCode: '22280-003',
  },

  hours: '24 horas',

  links: {
    googleMaps: 'https://www.google.com/maps?cid=5553564379686471721',
    instagram: 'https://www.instagram.com/expressbateriasrj/',
  },

  serviceArea: ['Zona Sul', 'Centro', 'Barra da Tijuca', 'Tijuca'],

  /**
   * Avaliações do Google — valores informados pela empresa.
   * Não há integração com a API do Google: atualize manualmente e mude
   * `checkedAt` sempre que conferir os números no perfil.
   */
  reviews: {
    rating: 5.0,
    count: 503,
    checkedAt: '2026-10',
    highlights: ['Rapidez', 'Eficiência', 'Profissionalismo', 'Atendimento atencioso', 'Preços competitivos'],
  },

  /** Compromissos comerciais confirmados pela empresa em 21/10/2026. */
  promises: {
    arrivalMinutes: 30,
    freeDeliveryAndInstall: true,
    installmentsNoInterest: 10,
    yearsInRio: 10,
    priceMatch: true,
  },
};

export const mapsDirectionsUrl = () => {
  const a = business.address;
  const dest = `${a.street}, ${a.district}, ${a.city} - ${a.state}, ${a.postalCode}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
};
