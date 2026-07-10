# 💰 FinancePro – Gestão Financeira Inteligente

Um sistema completo de gestão financeira pessoal e empresarial com integração PIX, IA para categorização automática, detecção de fraudes, e muito mais.

## ✨ Principais Funcionalidades

### 🏦 **Gestão Financeira Completa**
- Controle de receitas e despesas
- Orçamentos inteligentes por categoria
- Previsão financeira (forecasting)
- Múltiplas contas e patrimônios
- Metas e desafios financeiros

### 🤖 **IA & Automação**
- Categorização automática de transações (4 camadas de inteligência)
- Enriquecimento automático de transações PIX
- Detecção de fraudes em tempo real
- Sugestões inteligentes de economia
- Reconhecimento de padrões recorrentes

### 🚀 **PIX Integrado**
- Importação automática de extratos Bradesco
- Identificação inteligente de beneficiários PIX
- Histórico e mapeamento de chaves PIX
- Enriquecimento contextual de transações

### 📊 **Relatórios & Dashboards**
- Gráficos interativos (Chart.js)
- Relatórios personalizáveis em PDF
- Exportação para Excel/CSV
- Dashboard em tempo real

### 🔒 **Segurança**
- Tela de bloqueio com senha
- Criptografia de dados sensíveis
- Autenticação biométrica (WebAuthn)
- Backup automático na nuvem

### 🎮 **Gamificação**
- Sistema de conquistas
- Desafios financeiros
- Progresso e metas visuais
- Recompensas por economia

---

## 🛠️ Tecnologias Utilizadas

| Frontend | Bibliotecas | Recursos |
|----------|-------------|----------|
| HTML5/CSS3 | Dexie.js (IndexedDB) | PWA (Offline) |
| JavaScript ES6+ | Chart.js 4.x | Service Worker |
| Font Awesome 6.x | CryptoJS | Web Workers |
| Google Fonts | jsPDF | LocalStorage |
| SheetJS (XLSX) | | |

---

## 📁 Estrutura do Projeto

```
/workspace
├── index.html                 # Aplicação principal
├── manifest.json              # Configuração PWA
├── service-worker.js          # Cache offline
│
├── 🧠 Módulos Principais
├── app.js                     # Lógica central da aplicação
├── auth.js                    # Autenticação e segurança
├── db.js                      # Camada de banco de dados (Dexie)
├── transactions.js            # Gestão de transações
├── dashboard.js               # Dashboard e gráficos
├── calculator.js              # Calculadora financeira
├── importer.js                # Importação CSV/OFX/XLSX
├── exporter.js                # Exportação PDF/Excel
├── forecast.js                # Previsão financeira
├── subscriptions.js           # Assinaturas e recorrentes
├── patrimony.js               # Gestão patrimonial
├── lockscreen.js              # Tela de bloqueio
├── utils.js                   # Utilitários gerais
├── modules.js                 # Sistema de módulos
├── split.js                   # Divisão de despesas
│
├── 🤖 Módulos de IA & Extensões
├── fp-ai-pro.js               # Motor principal de IA
├── fp-ai-pro-v3.js            # Versão 3 do motor IA
├── fp-ai-maintenance.js       # Manutenção e suporte IA
├── fp-ai-melhorias-1-5.js     # Melhorias IA (1-5)
├── fp-ai-melhorias-6-10.js    # Melhorias IA (6-10)
├── fp-suggestions.js          # Sugestões inteligentes
├── fp-fraud.js                # Detecção de fraudes
├── fp-challenges.js           # Desafios gamificados
├── fp-education.js            # Educação financeira
│
├── 💳 Módulos PIX
├── fp-pix-enrichment.js       # Enriquecimento PIX
├── fp-pix-manager-ui.js       # UI gerenciador PIX
├── fp-pix-updater.js          # Atualizador PIX
├── fp-pix-smart-enricher.js   # Enriquecedor inteligente
│
├── 📥 Importação Avançada
├── fp-import-pro.js           # Importador profissional
├── fp-controle-financeiro.js  # Controle financeiro v3
├── fp-budget-pro.js           # Orçamento profissional
├── fp-categories-enhance.js   # Categorização avançada
│
├── 🌐 Integrações & LLM
├── fp-integrador.js           # Integrador mestre
├── fp-llm-pro.js              # Integração LLM
├── fp-core-pages.js           # Páginas principais
├── fp-pages-all.js            # Todas as páginas
│
├── 🔊 Acessibilidade
├── fp-tts.js                  # Text-to-Speech
├── fp-tts-ui.js               # UI TTS
├── fp-tts-worker.js           # Worker TTS
│
├── 🎨 Estilos
├── fp-extensions.css          # Estilos extensões
├── fp-ai-pro.css              # Estilos IA
├── fp-import-pro.css          # Estilos importação
├── fp-llm-pro.css             # Estilos LLM
│
├── 🛠️ Utilitários
├── fp-help.js                 # Sistema de ajuda
├── fp-task-panel.js           # Painel de tarefas
├── fp-progress-bar.js         # Barra de progresso
├── fp-telemetry.js            # Telemetria
├── fp-benchmark.js            # Benchmarks
└── fp-worker.js               # Web worker genérico
```

---

## 🚀 Como Usar

### **Instalação Rápida**

1. **Clone ou baixe o projeto:**
```bash
git clone <repository-url>
cd FinancePro
```

2. **Abra no navegador:**
   - Simplesmente abra `index.html` no seu navegador
   - Ou use um servidor local:
```bash
# Python
python -m http.server 8000

# Node.js
npx serve .
```

3. **Acesse:** `http://localhost:8000`

### **Configuração Inicial**

1. **Crie sua conta:**
   - Na tela inicial, clique em "Criar Conta"
   - Defina senha segura
   - Faça login

2. **Importe seus dados:**
   - Vá para a seção "Importar"
   - Selecione extrato bancário (CSV, OFX, XLSX)
   - O sistema categoriza automaticamente

3. **Configure PIX (Opcional):**
```javascript
// No console (F12), adicione beneficiários:
FP_PIX_ENRICHMENT.addBeneficiary('1601370', 'João Silva');
FP_PIX_ENRICHMENT.addBeneficiary('1625405', 'Maria Santos');

// Abra o gerenciador:
PIX_MANAGER.show()
```

---

## 📖 Documentação Detalhada

| Documento | Descrição |
|-----------|-----------|
| [PIX_AUTOMATICO_INTELIGENTE.md](./PIX_AUTOMATICO_INTELIGENTE.md) | Sistema automático de enriquecimento PIX |
| [README_PIX_SOLUTION.md](./README_PIX_SOLUTION.md) | Solução completa para beneficiários PIX |
| [GUIA_PRATICO_PIX.md](./GUIA_PRATICO_PIX.md) | Guia prático de uso do PIX |
| [SOLUCAO_BENEFICIARIOS_PIX.md](./SOLUCAO_BENEFICIARIOS_PIX.md) | Detalhes técnicos da solução PIX |
| [BRADESCO_IMPROVEMENTS.md](./BRADESCO_IMPROVEMENTS.md) | Melhorias para extratos Bradesco |
| [COMO_ATUALIZAR_PIX_EXISTENTES.md](./COMO_ATUALIZAR_PIX_EXISTENTES.md) | Tutorial de atualização PIX |

---

## 🎯 Casos de Uso

### **Para Usuários Pessoais**
- Controle gastos diários
- Planeje metas financeiras
- Receba alertas de gastos
- Acompanhe evolução patrimonial

### **Para Pequenas Empresas**
- Fluxo de caixa automatizado
- Conciliação bancária
- Relatórios gerenciais
- Controle de múltiplas contas

### **Para Contadores**
- Importação em massa
- Exportação para sistemas contábeis
- Relatórios personalizados
- Auditoria de transações

---

## 🔧 Personalização

### **Temas**
O sistema suporta temas claro e escuro:
```javascript
// Alternar tema
document.documentElement.setAttribute('data-theme', 'dark');
```

### **Módulos**
Ative/desative módulos conforme necessidade editando `modules.js`.

---

## 📱 Suporte a Dispositivos

- ✅ Desktop (Chrome, Firefox, Edge, Safari)
- ✅ Mobile (iOS Safari, Android Chrome)
- ✅ Tablet (iPadOS, Android)
- ✅ PWA (instalação como app nativo)
- ✅ Offline (funciona sem internet)

---

## 🔐 Segurança e Privacidade

- Todos os dados são armazenados localmente (IndexedDB)
- Senhas criptografadas com CryptoJS
- Sem envio de dados para servidores externos
- Compatível com LGPD

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Para contribuir:

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push (`git push origin feature/nova-feature`)
5. Abra um Pull Request

---

## 📄 Licença

Este projeto é experimental e destinado para fins educacionais e de teste.

---

## 📞 Suporte

Para dúvidas ou problemas:
- Consulte a documentação na pasta `/docs`
- Use o sistema de ajuda integrado (tecla F1)
- Verifique os arquivos `.md` no repositório

---

## 🙏 Agradecimentos

- **Dexie.js** - Banco de dados IndexedDB
- **Chart.js** - Gráficos interativos
- **SheetJS** - Processamento Excel
- **Font Awesome** - Ícones
- **jsPDF** - Geração de PDFs

---

<div align="center">

**Feito com ❤️ para educação financeira**

[⬆ Topo](#-financepro--gestão-financeira-inteligente)

</div>
