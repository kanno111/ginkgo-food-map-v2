import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './app/App.vue'
import router from './app/router'
import { reviewGatewayKey, textReviewGateway } from '@/modules/review'
import './shared/styles/main.css'

createApp(App)
  .use(createPinia())
  .use(router)
  .provide(reviewGatewayKey, textReviewGateway)
  .mount('#app')
