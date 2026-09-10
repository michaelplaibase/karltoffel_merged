import Swiper from 'swiper';
import { Autoplay, EffectFade, Pagination, Navigation, Scrollbar, A11y } from 'swiper/modules';
Swiper.use([Autoplay, EffectFade, Pagination, Navigation, Scrollbar, A11y]);
window.Swiper = Swiper;
export default Swiper;
