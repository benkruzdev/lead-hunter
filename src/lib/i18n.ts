import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
    tr: {
        translation: {
            // Auth
            auth: {
                login: 'Giriş Yap',
                register: 'Kayıt Ol',
                logout: 'Çıkış Yap',
                email: 'E-posta',
                password: 'Şifre',
                fullName: 'Ad Soyad',
                phone: 'Telefon',
                rememberMe: 'Beni Hatırla',
                forgotPassword: 'Şifremi Unuttum',
                resetPassword: 'Şifremi Sıfırla',
                googleLogin: 'Google ile Giriş Yap',
                alreadyHaveAccount: 'Zaten hesabın var mı?',
                noAccount: 'Hesabın yok mu?',
                backToLogin: 'Girişe Dön',
                sendResetLink: 'Sıfırlama Bağlantısı Gönder',
                newPassword: 'Yeni Şifre',
                confirmPassword: 'Şifre Tekrar',
                updatePassword: 'Şifreyi Güncelle',

                // Placeholders
                emailPlaceholder: 'ornek@sirket.com',
                passwordPlaceholder: '••••••••',
                fullNamePlaceholder: 'Ahmet Yılmaz',
                phonePlaceholder: '05XX XXX XX XX',

                // Messages
                loginSuccess: 'Giriş başarılı! Yönlendiriliyorsunuz...',
                registerSuccess: 'Kayıt başarılı! Hoş geldiniz!',
                resetLinkSent: 'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.',
                passwordUpdated: 'Şifreniz başarıyla güncellendi.',
                logoutSuccess: 'Çıkış yapıldı.',

                // Errors
                invalidCredentials: 'E-posta veya şifre hatalı.',
                emailAlreadyExists: 'Bu e-posta adresi zaten kullanılıyor.',
                weakPassword: 'Şifre en az 8 karakter olmalıdır.',
                requiredField: 'Bu alan zorunludur.',
                invalidEmail: 'Geçerli bir e-posta adresi giriniz.',
                invalidPhone: 'Geçerli bir telefon numarası giriniz (05XX XXX XX XX).',
                passwordMismatch: 'Şifreler eşleşmiyor.',
            },

            // Common
            common: {
                loading: 'Yükleniyor...',
                save: 'Kaydet',
                cancel: 'İptal',
                delete: 'Sil',
                edit: 'Düzenle',
                back: 'Geri',
                next: 'İleri',
                finish: 'Tamamla',
                skip: 'Atla',
                search: 'Ara',
                credits: 'Kredi',
                creditsRemaining: 'Kalan Kredi',
            },

            // Layout
            layout: {
                search: 'Arama',
                leadLists: 'Lead Listeleri',
                searchHistory: 'Arama Geçmişi',
                exports: 'Exportlar',
                billing: 'Faturalandırma',
                settings: 'Ayarlar',
                profile: 'Profil',
                buyCredits: 'Kredi Satın Al',
            },

            // Search History
            searchHistory: {
                title: 'Arama Geçmişi',
                description: 'Son 30 gün içinde yaptığınız aramalar',
                noHistory: 'Arama Geçmişi Yok',
                noHistoryDesc: 'Henüz bir arama yapmadınız',
                newSearch: 'Yeni Arama Yap',
                continueSearch: 'Devam Et',
                resultsFound: 'sonuç bulundu',
                pagesViewed: 'sayfa görüntülendi',
                keyword: 'Anahtar kelime',
                timeAgo: '{{time}} önce',
            },

            // Onboarding
            onboarding: {
                welcome: 'LeadHunter\'a Hoş Geldiniz!',
                step1Title: 'Şehir Seçin',
                step1Description: 'İşletmeleri aramak için şehir seçin.',
                step2Title: 'İlçe Seçin',
                step2Description: 'İsteğe bağlı olarak ilçe daraltması yapabilirsiniz.',
                step3Title: 'Kategori Yazın',
                step3Description: 'Aradığınız işletme kategorisini girin (ör: Restoran, Kuaför).',
                step4Title: 'Arama Yapın',
                step4Description: '\"Ara\" butonuna tıklayın ve sonuçları görün.',
                step5Title: 'Listeye Ekleyin',
                step5Description: 'İstediğiniz lead\'leri seçip listenize ekleyin.',
                step6Title: 'CSV İndirin',
                step6Description: 'Lead listenizi CSV formatında dışa aktarın.',
            },
        },
    },
    en: {
        translation: {
            // Auth
            auth: {
                login: 'Login',
                register: 'Sign Up',
                logout: 'Logout',
                email: 'Email',
                password: 'Password',
                fullName: 'Full Name',
                phone: 'Phone',
                rememberMe: 'Remember Me',
                forgotPassword: 'Forgot Password',
                resetPassword: 'Reset Password',
                googleLogin: 'Continue with Google',
                alreadyHaveAccount: 'Already have an account?',
                noAccount: 'Don\'t have an account?',
                backToLogin: 'Back to Login',
                sendResetLink: 'Send Reset Link',
                newPassword: 'New Password',
                confirmPassword: 'Confirm Password',
                updatePassword: 'Update Password',

                // Placeholders
                emailPlaceholder: 'you@company.com',
                passwordPlaceholder: '••••••••',
                fullNamePlaceholder: 'John Doe',
                phonePlaceholder: '05XX XXX XX XX',

                // Messages
                loginSuccess: 'Login successful! Redirecting...',
                registerSuccess: 'Registration successful! Welcome!',
                resetLinkSent: 'Password reset link has been sent to your email.',
                passwordUpdated: 'Your password has been successfully updated.',
                logoutSuccess: 'Logged out successfully.',

                // Errors
                invalidCredentials: 'Invalid email or password.',
                emailAlreadyExists: 'This email address is already in use.',
                weakPassword: 'Password must be at least 8 characters.',
                requiredField: 'This field is required.',
                invalidEmail: 'Please enter a valid email address.',
                invalidPhone: 'Please enter a valid phone number (05XX XXX XX XX).',
                passwordMismatch: 'Passwords do not match.',
            },

            // Common
            common: {
                loading: 'Loading...',
                save: 'Save',
                cancel: 'Cancel',
                delete: 'Delete',
                edit: 'Edit',
                back: 'Back',
                next: 'Next',
                finish: 'Finish',
                skip: 'Skip',
                search: 'Search',
                credits: 'Credits',
                creditsRemaining: 'Credits Remaining',
            },

            // Layout
            layout: {
                search: 'Search',
                leadLists: 'Lead Lists',
                searchHistory: 'Search History',
                exports: 'Exports',
                billing: 'Billing',
                settings: 'Settings',
                profile: 'Profile',
                buyCredits: 'Buy Credits',
            },

            // Search History
            searchHistory: {
                title: 'Search History',
                description: 'Your searches from the last 30 days',
                noHistory: 'No Search History',
                noHistoryDesc: 'You haven\'t performed any searches yet',
                newSearch: 'New Search',
                continueSearch: 'Continue',
                resultsFound: 'results found',
                pagesViewed: 'pages viewed',
                keyword: 'Keyword',
                timeAgo: '{{time}} ago',
            },

            // Onboarding
            onboarding: {
                welcome: 'Welcome to LeadHunter!',
                step1Title: 'Select City',
                step1Description: 'Choose a city to search for businesses.',
                step2Title: 'Select District',
                step2Description: 'Optionally narrow down by district.',
                step3Title: 'Enter Category',
                step3Description: 'Type the business category you\'re looking for (e.g.: Restaurant, Salon).',
                step4Title: 'Search',
                step4Description: 'Click the "Search" button and view results.',
                step5Title: 'Add to List',
                step5Description: 'Select leads and add them to your list.',
                step6Title: 'Download CSV',
                step6Description: 'Export your lead list in CSV format.',
            },
        },
    },
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'tr',
        detection: {
            order: ['localStorage', 'navigator'],
            caches: ['localStorage'],
        },
        interpolation: {
            escapeValue: false,
        },
    });

export default i18n;
