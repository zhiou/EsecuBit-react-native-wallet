import en from './en'
import zh_Hans from './zh_Hans'
import I18n from 'react-native-i18n'

I18n.defaultLocale = 'en'
I18n.fallbacks = true
I18n.translations = {
  'en': en,
  'zh-Hans': zh_Hans
}
export default I18n;