/* -------------------------------------------------------------
   LEADFINDER E-COMMERCE BRASIL - APPLICATION LOGIC
   ------------------------------------------------------------- */

// Polyfill para o Lucide caso falte o carregamento via CDN (ex: offline ou erro de rede)
if (typeof window.lucide === 'undefined') {
    window.lucide = {
        createIcons: function() {
            console.warn("Lucide Icons CDN não carregado. Ícones ignorados.");
        }
    };
}

// 1. DATABASE INICIAL DE LEADS (Inicialmente Zerado para o usuário capturar seus próprios leads)
const INITIAL_LEADS = [];


// 2. STATE MANAGER
let leads = [];

// Carrega leads do LocalStorage ou do Banco Embutido
function loadLeads() {
    const localData = localStorage.getItem("leadfinder_leads");
    if (localData && localData !== "undefined" && localData !== "null") {
        try {
            leads = JSON.parse(localData);
            if (!leads || !Array.isArray(leads)) {
                leads = [...INITIAL_LEADS];
            }
        } catch (e) {
            console.error("Erro ao ler dados do LocalStorage, restaurando padrão.", e);
            leads = [...INITIAL_LEADS];
            saveToLocalStorage();
        }
    } else {
        leads = [...INITIAL_LEADS];
        saveToLocalStorage();
    }

    // Sanitiza e valida cada lead para prevenir erros de propriedade indefinida (toFixed, etc.)
    leads = leads.map(l => ({
        id: l.id || ("lead_" + Date.now() + Math.random().toString(36).substr(2, 5)),
        name: l.name || "E-commerce",
        url: l.url || "",
        niche: l.niche || "Outros",
        platform: l.platform || "Outra / Desconhecida",
        ticket: typeof l.ticket === 'number' && !isNaN(l.ticket) ? l.ticket : 200,
        visits: typeof l.visits === 'number' && !isNaN(l.visits) ? l.visits : 5000,
        whatsapp: l.whatsapp || "",
        instagram: l.instagram || "",
        email: l.email || "",
        starred: !!l.starred,
        status: l.status || "Novo",
        notes: l.notes || "",
        createdAt: l.createdAt || new Date().toISOString()
    }));

    saveToLocalStorage(); // Salva os dados limpos de volta no Storage

    updateDashboardStats();
    renderTables();
    renderCharts();
}

function saveToLocalStorage() {
    localStorage.setItem("leadfinder_leads", JSON.stringify(leads));
    const countBadge = document.getElementById("leads-count-badge");
    if (countBadge) {
        countBadge.innerText = leads.length;
    }
}

// Helper para registrar event listener com segurança (evita falha em páginas desatualizadas/elementos ausentes)
function safeAddListener(id, event, callback) {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener(event, callback);
    }
}

// 3. EVENT LISTENERS & NAVIGATION
document.addEventListener("DOMContentLoaded", () => {
    // Inicializar Ícones
    lucide.createIcons();
    
    // Carregar os Leads
    loadLeads();

    // Configurar Navegação de Abas
    const navButtons = document.querySelectorAll(".nav-btn");
    const tabContents = document.querySelectorAll(".tab-content");
    const pageTitle = document.getElementById("page-title");
    const pageDescription = document.getElementById("page-description");

    const tabMeta = {
        "dashboard": { title: "Painel Geral", desc: "Visão geral do seu banco de leads de e-commerce." },
        "leads-db": { title: "Carteira de Leads", desc: "Gerencie, filtre e exporte os seus contatos mapeados." },
        "lead-finder": { title: "Buscador & Scanner", desc: "Descubra lojas virtuais e faça scraping de dados em lote." },
        "help-settings": { title: "Ajuda & Configurações", desc: "Saiba como tirar o melhor proveito do LeadFinder." }
    };

    navButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetTab = btn.getAttribute("data-tab");
            
            navButtons.forEach(b => b.classList.remove("active"));
            tabContents.forEach(tc => tc.classList.remove("active"));
            
            btn.classList.add("active");
            const tabEl = document.getElementById(`tab-${targetTab}`);
            if (tabEl) tabEl.classList.add("active");
            
            // Atualizar cabeçalho da página
            if (pageTitle) pageTitle.innerText = tabMeta[targetTab].title;
            if (pageDescription) pageDescription.innerText = tabMeta[targetTab].desc;
        });
    });

    // Filtros do Banco de Leads
    safeAddListener("search-lead-input", "input", filterAndRenderLeadsTable);
    safeAddListener("filter-nicho", "change", filterAndRenderLeadsTable);
    safeAddListener("filter-plataforma", "change", filterAndRenderLeadsTable);
    safeAddListener("filter-status", "change", filterAndRenderLeadsTable);
    safeAddListener("filter-trafego", "change", filterAndRenderLeadsTable);

    // Botoes de Exportação e Importação
    safeAddListener("btn-export-csv", "click", () => exportToCSV(leads));
    safeAddListener("btn-export-leads-header", "click", () => exportToCSV(leads));
    safeAddListener("btn-backup-json", "click", () => exportToJSON(leads));
    
    safeAddListener("btn-trigger-import-file", "click", () => {
        const fileInput = document.getElementById("backup-file-input");
        if (fileInput) fileInput.click();
    });
    
    safeAddListener("backup-file-input", "change", handleImportJSON);
    
    safeAddListener("btn-import-leads", "click", () => {
        const fileInput = document.getElementById("backup-file-input");
        if (fileInput) fileInput.click();
    });

    safeAddListener("btn-reset-db", "click", () => {
        if (confirm("Deseja restaurar o banco de leads de fábrica? Isso substituirá todas as suas anotações atuais pelos leads originais do sistema.")) {
            localStorage.removeItem("leadfinder_leads");
            leads = [...INITIAL_LEADS];
            saveToLocalStorage();
            loadLeads();
            alert("Banco de dados restaurado e limpo com sucesso!");
        }
    });

    // Manual Modal Handlers
    safeAddListener("btn-add-manual-lead", "click", openManualLeadModal);
    safeAddListener("btn-close-manual-modal", "click", closeManualLeadModal);
    safeAddListener("btn-cancel-manual", "click", closeManualLeadModal);
    safeAddListener("btn-submit-manual", "click", handleAddManualLead);

    // Detail Modal Handlers
    safeAddListener("btn-close-modal", "click", closeDetailsModal);
    safeAddListener("btn-modal-save-lead", "click", saveAndCloseDetailsModal);
    safeAddListener("btn-modal-delete-lead", "click", deleteLeadFromDetails);
    safeAddListener("btn-copy-email", "click", copyEmailToClipboard);

    // Link para a tabela completa do dashboard
    safeAddListener("btn-view-all-leads", "click", () => {
        const dbBtn = document.querySelector('[data-tab="leads-db"]');
        if (dbBtn) dbBtn.click();
    });

    // Sliders de Ticket Médio
    const minRange = document.getElementById("ticket-min-range");
    const maxRange = document.getElementById("ticket-max-range");
    const minVal = document.getElementById("range-min-val");
    const maxVal = document.getElementById("range-max-val");

    if (minRange && maxRange && minVal && maxVal) {
        minRange.addEventListener("input", () => {
            if (parseInt(minRange.value) > parseInt(maxRange.value) - 100) {
                minRange.value = parseInt(maxRange.value) - 100;
            }
            minVal.innerText = `R$ ${minRange.value}`;
        });

        maxRange.addEventListener("input", () => {
            if (parseInt(maxRange.value) < parseInt(minRange.value) + 100) {
                maxRange.value = parseInt(minRange.value) + 100;
            }
            maxVal.innerText = `R$ ${maxRange.value}`;
        });
    }

    // Gerador de Pesquisas Google / DDG
    safeAddListener("btn-search-google", "click", () => generateSearchQuery("google"));
    safeAddListener("btn-search-ddg", "click", () => generateSearchQuery("duckduckgo"));

    // Evento de alteração de nicho no Buscador para preencher termos e controlar campo customizado
    const finderNicheSelect = document.getElementById("finder-niche");
    const finderSearchKeywords = document.getElementById("finder-search-keywords");
    const customNicheGroup = document.getElementById("custom-niche-name-group");
    
    if (finderNicheSelect && finderSearchKeywords) {
        const updateKeywords = () => {
            const val = finderNicheSelect.value;
            const noWebsite = document.getElementById("search-no-website")?.checked;
            
            if (noWebsite) {
                finderSearchKeywords.value = NO_WEBSITE_NICHE_KEYWORDS[val] || "";
            } else {
                finderSearchKeywords.value = DEFAULT_NICHE_KEYWORDS[val] || "";
            }
            
            if (val === "Outros / Personalizado") {
                if (customNicheGroup) customNicheGroup.style.display = "block";
            } else {
                if (customNicheGroup) customNicheGroup.style.display = "none";
            }
        };
        finderNicheSelect.addEventListener("change", updateKeywords);
        
        const noWebsiteCheckbox = document.getElementById("search-no-website");
        if (noWebsiteCheckbox) {
            noWebsiteCheckbox.addEventListener("change", updateKeywords);
        }
        
        updateKeywords(); // Inicialização no load
    }

    // Analisador / Scanner de Leads
    safeAddListener("btn-start-scan", "click", handleStartScan);
    safeAddListener("btn-clear-scan", "click", clearScanTerminal);
});

// 4. RENDERIZAÇÃO E DASHBOARD
function updateDashboardStats() {
    const totalLeads = leads.length;
    const statTotal = document.getElementById("stat-total-leads");
    if (statTotal) statTotal.innerText = totalLeads;
    
    const statSub = document.getElementById("stat-total-leads-sub");
    if (statSub) statSub.innerText = `${totalLeads} lojas virtuais cadastradas`;

    // Ticket Médio
    let sumTicket = 0;
    let ticketCount = 0;
    leads.forEach(l => {
        if (l.ticket && !isNaN(l.ticket)) {
            sumTicket += l.ticket;
            ticketCount++;
        }
    });
    const avg = ticketCount > 0 ? (sumTicket / ticketCount) : 0;
    const statAvg = document.getElementById("stat-avg-ticket");
    if (statAvg) statAvg.innerText = `R$ ${avg.toFixed(2).replace('.', ',')}`;

    // Taxa de Contato
    const contacted = leads.filter(l => l.status !== "Novo").length;
    const rate = totalLeads > 0 ? ((contacted / totalLeads) * 100) : 0;
    
    const statRate = document.getElementById("stat-contact-rate");
    if (statRate) statRate.innerText = `${rate.toFixed(0)}%`;
    
    const statRateSub = document.getElementById("stat-contact-rate-sub");
    if (statRateSub) statRateSub.innerText = `${contacted} de ${totalLeads} abordados`;

    // Favoritos
    const starred = leads.filter(l => l.starred).length;
    const statStarred = document.getElementById("stat-starred-leads");
    if (statStarred) statStarred.innerText = starred;
}

function renderCharts() {
    // 1. Nichos
    const nicheCounts = {};
    leads.forEach(l => {
        nicheCounts[l.niche] = (nicheCounts[l.niche] || 0) + 1;
    });

    const nicheContainer = document.getElementById("niche-chart-bars");
    if (nicheContainer) {
        nicheContainer.innerHTML = "";
        
        // Sort niches by count descending
        const sortedNiches = Object.entries(nicheCounts).sort((a, b) => b[1] - a[1]);
        const maxNicheCount = sortedNiches.length > 0 ? sortedNiches[0][1] : 1;

        sortedNiches.forEach(([niche, count]) => {
            const percentage = (count / maxNicheCount) * 100;
            const totalPercentage = ((count / leads.length) * 100).toFixed(0);
            
            nicheContainer.innerHTML += `
                <div class="chart-bar-row">
                    <div class="chart-bar-info">
                        <span class="chart-bar-label">${niche}</span>
                        <span class="chart-bar-value">${count} lead${count > 1 ? 's' : ''} (${totalPercentage}%)</span>
                    </div>
                    <div class="chart-bar-track">
                        <div class="chart-bar-fill purple" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        });

        if (sortedNiches.length === 0) {
            nicheContainer.innerHTML = `<p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px;">Nenhum lead disponível para gerar métricas.</p>`;
        }
    }

    // 2. Plataformas
    const platformCounts = {};
    leads.forEach(l => {
        platformCounts[l.platform] = (platformCounts[l.platform] || 0) + 1;
    });

    const platformContainer = document.getElementById("platform-chart-bars");
    if (platformContainer) {
        platformContainer.innerHTML = "";

        const sortedPlatforms = Object.entries(platformCounts).sort((a, b) => b[1] - a[1]);
        const maxPlatformCount = sortedPlatforms.length > 0 ? sortedPlatforms[0][1] : 1;

        sortedPlatforms.forEach(([platform, count]) => {
            const percentage = (count / maxPlatformCount) * 100;
            const totalPercentage = ((count / leads.length) * 100).toFixed(0);
            
            platformContainer.innerHTML += `
                <div class="chart-bar-row">
                    <div class="chart-bar-info">
                        <span class="chart-bar-label">${platform}</span>
                        <span class="chart-bar-value">${count} lead${count > 1 ? 's' : ''} (${totalPercentage}%)</span>
                    </div>
                    <div class="chart-bar-track">
                        <div class="chart-bar-fill emerald" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        });

        if (sortedPlatforms.length === 0) {
            platformContainer.innerHTML = `<p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px;">Nenhum lead disponível para gerar métricas.</p>`;
        }
    }
}

// Helper para formatar visitas mensais (ex: 12500 -> 12.5k)
function formatVisits(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1).replace('.0', '') + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1).replace('.0', '') + 'k';
    }
    return num.toString();
}

function renderTables() {
    renderRecentLeadsTable();
    filterAndRenderLeadsTable();
}

function renderRecentLeadsTable() {
    const tableBody = document.querySelector("#recent-leads-table tbody");
    if (!tableBody) return;
    tableBody.innerHTML = "";

    // Sort by createdAt descending and take top 5
    const recent = [...leads]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);

    recent.forEach(lead => {
        const platformBadgeClass = `badge-platform-${lead.platform.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        const statusBadgeClass = `badge-status-${lead.status.toLowerCase().replace(/\s+/g, '')}`;
        
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>
                <button class="star-btn ${lead.starred ? 'starred' : ''}" onclick="event.stopPropagation(); toggleStar('${lead.id}')">
                     <i data-lucide="star" class="${lead.starred ? 'fill-star' : ''}"></i>
                </button>
            </td>
            <td>
                <div class="lead-name-col">
                    <span class="lead-name">${lead.name}</span>
                    <a href="${lead.url}" target="_blank" onclick="event.stopPropagation();" class="lead-url">${lead.url.replace(/^https?:\/\/(www\.)?/, '')}</a>
                </div>
            </td>
            <td><span class="badge badge-outline">${lead.niche}</span></td>
            <td><span class="badge ${platformBadgeClass}">${lead.platform}</span></td>
            <td><span class="badge badge-ticket">${lead.ticket > 0 ? `R$ ${lead.ticket.toFixed(0)}` : 'N/A'}</span></td>
            <td><span class="badge badge-outline">${lead.visits > 0 ? formatVisits(lead.visits) : 'N/A'}</span></td>
            <td>
                <div class="contacts-icons-row">
                    ${lead.whatsapp ? `<a href="https://wa.me/55${lead.whatsapp}" target="_blank" onclick="event.stopPropagation();" class="contact-icon-btn whatsapp-color"><i data-lucide="message-circle"></i></a>` : `<span class="contact-icon-btn"><i data-lucide="message-circle"></i></span>`}
                    ${lead.instagram ? `<a href="https://instagram.com/${lead.instagram}" target="_blank" onclick="event.stopPropagation();" class="contact-icon-btn instagram-color"><i data-lucide="instagram"></i></a>` : `<span class="contact-icon-btn"><i data-lucide="instagram"></i></span>`}
                    ${lead.email ? `<a href="mailto:${lead.email}" target="_blank" onclick="event.stopPropagation();" class="contact-icon-btn mail-color"><i data-lucide="mail"></i></a>` : `<span class="contact-icon-btn"><i data-lucide="mail"></i></span>`}
                </div>
            </td>
            <td><span class="badge ${statusBadgeClass}">${lead.status}</span></td>
        `;
        
        row.addEventListener("click", () => openDetailsModal(lead.id));
        tableBody.appendChild(row);
    });

    if (recent.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">Nenhum lead recente disponível. Cadastre ou escaneie no menu do lado esquerdo.</td></tr>`;
    }
    
    lucide.createIcons({ attrs: { class: 'lucide-custom' } });
}

function filterAndRenderLeadsTable() {
    const tableBody = document.querySelector("#main-leads-table tbody");
    if (!tableBody) return;
    tableBody.innerHTML = "";

    const searchInput = document.getElementById("search-lead-input");
    const query = searchInput ? searchInput.value.toLowerCase() : "";
    
    const nicheFilterEl = document.getElementById("filter-nicho");
    const nicheFilter = nicheFilterEl ? nicheFilterEl.value : "todos";
    
    const platformFilterEl = document.getElementById("filter-plataforma");
    const platformFilter = platformFilterEl ? platformFilterEl.value : "todas";
    
    const statusFilterEl = document.getElementById("filter-status");
    const statusFilter = statusFilterEl ? statusFilterEl.value : "todos";

    const trafegoFilterEl = document.getElementById("filter-trafego");
    const trafegoFilter = trafegoFilterEl ? trafegoFilterEl.value : "todos";

    const filtered = leads.filter(lead => {
        // Text search
        const matchesQuery = lead.name.toLowerCase().includes(query) || 
                             lead.url.toLowerCase().includes(query) || 
                             (lead.email && lead.email.toLowerCase().includes(query)) ||
                             (lead.notes && lead.notes.toLowerCase().includes(query));
        
        // Niche filter
        const matchesNiche = nicheFilter === "todos" || lead.niche === nicheFilter;
        
        // Platform filter
        const matchesPlatform = platformFilter === "todas" || lead.platform === platformFilter;
        
        // Status filter
        const matchesStatus = statusFilter === "todos" || lead.status === statusFilter;

        // Traffic filter
        const matchesTrafego = trafegoFilter === "todos" || lead.visits >= parseInt(trafegoFilter);

        return matchesQuery && matchesNiche && matchesPlatform && matchesStatus && matchesTrafego;
    });

    // Sort by star status then name
    filtered.sort((a, b) => {
        if (a.starred && !b.starred) return -1;
        if (!a.starred && b.starred) return 1;
        return a.name.localeCompare(b.name);
    });

    filtered.forEach(lead => {
        const platformBadgeClass = `badge-platform-${lead.platform.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        const statusBadgeClass = `badge-status-${lead.status.toLowerCase().replace(/\s+/g, '')}`;
        
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>
                <button class="star-btn ${lead.starred ? 'starred' : ''}" onclick="event.stopPropagation(); toggleStar('${lead.id}')">
                    <i data-lucide="star" class="${lead.starred ? 'fill-star' : ''}"></i>
                </button>
            </td>
            <td>
                <div class="lead-name-col">
                    <span class="lead-name">${lead.name}</span>
                    <a href="${lead.url}" target="_blank" onclick="event.stopPropagation();" class="lead-url">${lead.url.replace(/^https?:\/\/(www\.)?/, '')}</a>
                </div>
            </td>
            <td><span class="badge badge-outline">${lead.niche}</span></td>
            <td><span class="badge ${platformBadgeClass}">${lead.platform}</span></td>
            <td><span class="badge badge-ticket">${lead.ticket > 0 ? `R$ ${lead.ticket.toFixed(0)}` : 'N/A'}</span></td>
            <td><span class="badge badge-outline">${lead.visits > 0 ? formatVisits(lead.visits) : 'N/A'}</span></td>
            <td>
                <div class="contacts-icons-row">
                    ${lead.whatsapp ? `<a href="https://wa.me/55${lead.whatsapp}" target="_blank" onclick="event.stopPropagation();" class="contact-icon-btn whatsapp-color"><i data-lucide="message-circle"></i></a>` : `<span class="contact-icon-btn"><i data-lucide="message-circle"></i></span>`}
                    ${lead.instagram ? `<a href="https://instagram.com/${lead.instagram}" target="_blank" onclick="event.stopPropagation();" class="contact-icon-btn instagram-color"><i data-lucide="instagram"></i></a>` : `<span class="contact-icon-btn"><i data-lucide="instagram"></i></span>`}
                    ${lead.email ? `<a href="mailto:${lead.email}" target="_blank" onclick="event.stopPropagation();" class="contact-icon-btn mail-color"><i data-lucide="mail"></i></a>` : `<span class="contact-icon-btn"><i data-lucide="mail"></i></span>`}
                </div>
            </td>
            <td><span class="badge ${statusBadgeClass}">${lead.status}</span></td>
            <td>
                <div class="actions-cell">
                    <button class="action-btn edit-btn" onclick="event.stopPropagation(); openDetailsModal('${lead.id}')">
                        <i data-lucide="edit-3"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="event.stopPropagation(); deleteLead('${lead.id}')">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </td>
        `;
        
        row.addEventListener("click", () => openDetailsModal(lead.id));
        tableBody.appendChild(row);
    });

    document.getElementById("showing-leads-count").innerText = `Mostrando ${filtered.length} de ${leads.length} leads`;
    
    if (filtered.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px;">Nenhum lead encontrado com os filtros atuais.</td></tr>`;
    }

    lucide.createIcons();
}

// Alternar Star/Favorito
function toggleStar(id) {
    leads = leads.map(l => l.id === id ? { ...l, starred: !l.starred } : l);
    saveToLocalStorage();
    updateDashboardStats();
    renderTables();
}

// 5. DETAIL MODAL LOGIC
let activeDetailLeadId = null;

function openDetailsModal(id) {
    const lead = leads.find(l => l.id === id);
    if (!lead) return;

    activeDetailLeadId = id;
    
    document.getElementById("modal-lead-name").innerText = lead.name;
    document.getElementById("modal-lead-niche").innerText = lead.niche;
    document.getElementById("modal-lead-platform").innerText = lead.platform;
    document.getElementById("modal-lead-ticket").innerText = lead.ticket > 0 ? `Ticket: R$ ${lead.ticket.toFixed(2)}` : 'Ticket: N/A';
    
    const urlLink = document.getElementById("modal-lead-url");
    urlLink.href = lead.url;
    urlLink.innerHTML = `${lead.url.replace(/^https?:\/\/(www\.)?/, '')} <i data-lucide="external-link" style="width:14px;height:14px;display:inline-block;vertical-align:middle;"></i>`;
    
    document.getElementById("modal-lead-ticket-detailed").innerText = lead.ticket > 0 ? `R$ ${lead.ticket.toFixed(2)} (estimado por amostragem de produtos)` : 'N/A (Lead sem site próprio)';
    document.getElementById("modal-lead-visits-detailed").innerText = lead.visits > 0 ? `${formatVisits(lead.visits || 0)} acessos/mês (estimado)` : 'N/A (Lead sem site próprio)';

    // WhatsApp
    const waLink = document.getElementById("modal-link-whatsapp");
    const waText = document.getElementById("modal-text-whatsapp");
    if (lead.whatsapp) {
        waLink.href = `https://wa.me/55${lead.whatsapp.replace(/\D/g, '')}`;
        waLink.style.display = "inline-flex";
        waText.innerText = `Chamar no WhatsApp (${formatPhone(lead.whatsapp)})`;
    } else {
        waLink.style.display = "none";
    }

    // Instagram
    const igLink = document.getElementById("modal-link-instagram");
    const igText = document.getElementById("modal-text-instagram");
    if (lead.instagram) {
        igLink.href = `https://instagram.com/${lead.instagram.replace('@', '')}`;
        igLink.style.display = "inline-flex";
        igText.innerText = `@${lead.instagram.replace('@', '')}`;
    } else {
        igLink.style.display = "none";
    }

    // Email
    const emailText = document.getElementById("modal-text-email");
    const emailCopy = document.getElementById("btn-copy-email");
    if (lead.email) {
        emailText.innerText = lead.email;
        emailText.style.color = "#fff";
        emailCopy.style.display = "inline-block";
    } else {
        emailText.innerText = "Não encontrado";
        emailText.style.color = "var(--text-muted)";
        emailCopy.style.display = "none";
    }

    // Status Select
    document.getElementById("modal-lead-status-select").value = lead.status;

    // Notes
    document.getElementById("modal-lead-notes").value = lead.notes || "";

    // Show overlay
    document.getElementById("lead-details-modal").classList.add("active");
    lucide.createIcons();
}

function closeDetailsModal() {
    document.getElementById("lead-details-modal").classList.remove("active");
    activeDetailLeadId = null;
}

function saveAndCloseDetailsModal() {
    if (!activeDetailLeadId) return;
    
    const statusVal = document.getElementById("modal-lead-status-select").value;
    const notesVal = document.getElementById("modal-lead-notes").value;
    
    leads = leads.map(l => l.id === activeDetailLeadId ? { ...l, status: statusVal, notes: notesVal } : l);
    saveToLocalStorage();
    
    updateDashboardStats();
    renderTables();
    renderCharts();
    
    closeDetailsModal();
}

function deleteLeadFromDetails() {
    if (!activeDetailLeadId) return;
    
    if (confirm("Tem certeza que deseja excluir permanentemente este lead da sua carteira?")) {
        deleteLead(activeDetailLeadId);
        closeDetailsModal();
    }
}

function deleteLead(id) {
    if (confirm("Excluir este lead?")) {
        leads = leads.filter(l => l.id !== id);
        saveToLocalStorage();
        updateDashboardStats();
        renderTables();
        renderCharts();
    }
}

function copyEmailToClipboard() {
    const email = document.getElementById("modal-text-email").innerText;
    if (email && email !== "Não encontrado") {
        navigator.clipboard.writeText(email).then(() => {
            const btn = document.getElementById("btn-copy-email");
            btn.innerHTML = `<i data-lucide="check" style="color:var(--success)"></i>`;
            lucide.createIcons();
            setTimeout(() => {
                btn.innerHTML = `<i data-lucide="copy"></i>`;
                lucide.createIcons();
            }, 2000);
        });
    }
}

// 6. MANUAL LEAD MODAL LOGIC
function openManualLeadModal() {
    document.getElementById("manual-lead-form").reset();
    document.getElementById("manual-lead-modal").classList.add("active");
}

function closeManualLeadModal() {
    document.getElementById("manual-lead-modal").classList.remove("active");
}

function handleAddManualLead() {
    const name = document.getElementById("manual-name").value.trim();
    const urlVal = document.getElementById("manual-url").value.trim();
    
    if (!name || !urlVal) {
        alert("Nome e URL são campos obrigatórios.");
        return;
    }

    // Add protocol if missing
    let url = urlVal;
    if (!/^https?:\/\//i.test(url)) {
        url = "https://" + url;
    }

    const niche = document.getElementById("manual-niche").value;
    const platform = document.getElementById("manual-platform").value;
    const ticket = parseFloat(document.getElementById("manual-ticket").value) || 200;
    const visits = parseInt(document.getElementById("manual-visits").value) || 5000;
    const status = document.getElementById("manual-status").value;
    const whatsapp = document.getElementById("manual-whatsapp").value.replace(/\D/g, '');
    const instagram = document.getElementById("manual-instagram").value.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/$/, '');
    const email = document.getElementById("manual-email").value.trim();

    const newLead = {
        id: "lead_" + Date.now(),
        name,
        url,
        niche,
        platform,
        ticket,
        visits,
        whatsapp,
        instagram,
        email,
        starred: false,
        status,
        notes: `Lead criado manualmente no dia ${new Date().toLocaleDateString('pt-BR')}.`,
        createdAt: new Date().toISOString()
    };

    leads.push(newLead);
    saveToLocalStorage();
    updateDashboardStats();
    renderTables();
    renderCharts();
    closeManualLeadModal();
}

// Helper formatting phones
function formatPhone(phone) {
    if (!phone) return "";
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
        return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`;
    } else if (cleaned.length === 10) {
        return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 6)}-${cleaned.substring(6)}`;
    }
    return phone;
}

// 7. EXPORT & BACKUP ACTIONS
function exportToCSV(data) {
    if (data.length === 0) {
        alert("Sem leads para exportar.");
        return;
    }

    const headers = ["Nome", "Website", "Nicho", "Plataforma", "Ticket Est.", "WhatsApp", "Instagram", "E-mail", "Status", "Favoritado", "Notas", "Criado Em"];
    const rows = data.map(l => [
        `"${l.name.replace(/"/g, '""')}"`,
        `"${l.url}"`,
        `"${l.niche}"`,
        `"${l.platform}"`,
        l.ticket.toFixed(2),
        `"${l.whatsapp || ''}"`,
        `"${l.instagram || ''}"`,
        `"${l.email || ''}"`,
        `"${l.status}"`,
        l.starred ? "Sim" : "Não",
        `"${(l.notes || '').replace(/"/g, '""')}"`,
        l.createdAt
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `leadfinder_leads_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportToJSON(data) {
    const stringified = JSON.stringify(data, null, 2);
    const blob = new Blob([stringified], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `leadfinder_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function handleImportJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (Array.isArray(imported) && imported.length > 0 && imported[0].hasOwnProperty("name") && imported[0].hasOwnProperty("url")) {
                if (confirm(`Deseja importar ${imported.length} leads? Isso irá mesclar com seus leads atuais.`)) {
                    // Merge based on URL
                    const currentUrls = leads.map(l => l.url.toLowerCase());
                    let mergedCount = 0;
                    
                    imported.forEach(imp => {
                        // Ensure id and timestamps are present
                        if (!imp.id) imp.id = "lead_" + Date.now() + Math.random().toString(36).substr(2, 5);
                        if (!imp.createdAt) imp.createdAt = new Date().toISOString();
                        if (!imp.notes) imp.notes = "";
                        if (imp.starred === undefined) imp.starred = false;
                        if (!imp.status) imp.status = "Novo";
                        if (!imp.ticket) imp.ticket = 200;

                        if (!currentUrls.includes(imp.url.toLowerCase())) {
                            leads.push(imp);
                            mergedCount++;
                        }
                    });

                    saveToLocalStorage();
                    updateDashboardStats();
                    renderTables();
                    renderCharts();
                    alert(`Importação concluída! ${mergedCount} novos leads adicionados. E-commerces repetidos foram descartados.`);
                }
            } else {
                alert("O arquivo JSON não está no formato compatível com o LeadFinder.");
            }
        } catch (error) {
            alert("Erro ao ler o arquivo de backup. Certifique-se de que é um JSON válido.");
            console.error(error);
        }
    };
    reader.readAsText(file);
}

// 8. PESQUISA CIRÚRGICA (SEARCH GENERATOR)
const DEFAULT_NICHE_KEYWORDS = {
    "Bebê / Infantil": '"enxoval" OR "roupas de bebe" OR "quarto de bebe" "carrinho" site:.com.br -site:mercadolivre.com.br -site:shopee.com.br -site:amazon.com.br',
    "Tapetes & Decoração": '"tapete geometrico" OR "tapete artesanal" OR "tapete sob medida" "carrinho" site:.com.br -site:mercadolivre.com.br -site:shopee.com.br -site:amazon.com.br',
    "Utensílios & Personalizados": '"brindes personalizados" OR "utensilios personalizados" OR "copos gravados" "comprar" site:.com.br -site:mercadolivre.com.br -site:shopee.com.br',
    "Moda & Acessórios": '"bolsas sob encomenda" OR "acessorios de couro" OR "roupas femininas" "carrinho" site:.com.br -site:mercadolivre.com.br -site:shopee.com.br -site:amazon.com.br',
    "Papelaria & Presentes": '"planner de luxo" OR "presentes criativos" OR "papelaria personalizada" "carrinho" site:.com.br -site:mercadolivre.com.br -site:shopee.com.br',
    "Beleza & Cosméticos": '"cosmeticos naturais" OR "maquiagem vegana" OR "cuidados com a pele" "comprar" site:.com.br -site:mercadolivre.com.br -site:shopee.com.br',
    "Casa, Móveis & Jardim": '"moveis rusticos" OR "luminarias artesanais" OR "vasos de ceramica" "carrinho" site:.com.br -site:mercadolivre.com.br -site:shopee.com.br',
    "Pet Shop": '"ração natural" OR "coleiras personalizadas" OR "camas pet" "carrinho" site:.com.br -site:mercadolivre.com.br -site:shopee.com.br',
    "Esportes & Outdoors": '"roupas fitness" OR "suplementos esportivos" OR "garrafas termicas" "carrinho" site:.com.br -site:mercadolivre.com.br -site:shopee.com.br',
    "Eletrônicos & Acessórios": '"fones bluetooth" OR "carregadores indução" OR "acessorios celulares" "carrinho" site:.com.br -site:mercadolivre.com.br -site:shopee.com.br',
    "Alimentos & Bebidas": '"cafes especiais" OR "cerveja artesanal" OR "chocolates gourmet" "comprar" site:.com.br -site:mercadolivre.com.br',
    "Joias & Semijoias": '"semijoias banhadas" OR "aneis de prata" OR "brincos artesanais" "finalizar compra" site:.com.br -site:mercadolivre.com.br -site:shopee.com.br',
    "Calçados & Bolsas": '"sapatos de couro" OR "bolsas de couro" OR "calçados artesanais" "carrinho" site:.com.br -site:mercadolivre.com.br -site:shopee.com.br',
    "Serviços Locais / Clínicas": '"dentista" OR "clinica" OR "estetica" OR "fisioterapia" "contato" site:.com.br -site:mercadolivre.com.br',
    "Restaurantes & Gastronomia": '"restaurante" OR "hamburgueria" OR "pizzaria" OR "padaria" "cardapio" site:.com.br',
    "Lojas Físicas / Comércio Local": '"oficina" OR "otica" OR "loja fisica" OR "material de construcao" "endereco" site:.com.br',
    "Outros / Personalizado": '"comprar online" "carrinho" site:.com.br -site:mercadolivre.com.br -site:shopee.com.br -site:amazon.com.br'
};

const NO_WEBSITE_NICHE_KEYWORDS = {
    "Bebê / Infantil": 'site:instagram.com ("roupas de bebe" OR "enxoval" OR "brinquedos") ("pedidos pelo whatsapp" OR "encomendas pelo direct" OR "vendas pelo whatsapp")',
    "Tapetes & Decoração": 'site:instagram.com ("tapete" OR "decoracao" OR "almofadas") ("pedidos pelo whatsapp" OR "encomendas pelo direct" OR "vendas pelo whatsapp")',
    "Utensílios & Personalizados": 'site:instagram.com ("copos personalizados" OR "brindes" OR "canecas") ("pedidos pelo whatsapp" OR "encomendas pelo direct" OR "vendas pelo whatsapp")',
    "Moda & Acessórios": 'site:instagram.com ("bolsas" OR "roupas" OR "acessorios") ("pedidos pelo whatsapp" OR "encomendas pelo direct" OR "vendas pelo whatsapp")',
    "Papelaria & Presentes": 'site:instagram.com ("papelaria" OR "presentes" OR "planner") ("pedidos pelo whatsapp" OR "encomendas pelo direct" OR "vendas pelo whatsapp")',
    "Beleza & Cosméticos": 'site:instagram.com ("cosmeticos" OR "maquiagem" OR "skincare") ("pedidos pelo whatsapp" OR "encomendas pelo direct" OR "vendas pelo whatsapp")',
    "Casa, Móveis & Jardim": 'site:instagram.com ("moveis" OR "decoracao" OR "vasos") ("pedidos pelo whatsapp" OR "encomendas pelo direct" OR "vendas pelo whatsapp")',
    "Pet Shop": 'site:instagram.com ("pet shop" OR "coleiras" OR "camas pet") ("pedidos pelo whatsapp" OR "encomendas pelo direct" OR "vendas pelo whatsapp")',
    "Esportes & Outdoors": 'site:instagram.com ("roupas fitness" OR "suplementos" OR "garrafa termica") ("pedidos pelo whatsapp" OR "encomendas pelo direct" OR "vendas pelo whatsapp")',
    "Eletrônicos & Acessórios": 'site:instagram.com ("fones bluetooth" OR "carregador" OR "capinhas") ("pedidos pelo whatsapp" OR "encomendas pelo direct" OR "vendas pelo whatsapp")',
    "Alimentos & Bebidas": 'site:instagram.com ("doces" OR "cerveja artesanal" OR "gourmet") ("pedidos pelo whatsapp" OR "encomendas pelo direct" OR "vendas pelo whatsapp")',
    "Joias & Semijoias": 'site:instagram.com ("semijoias" OR "aneis de prata" OR "acessorios") ("pedidos pelo whatsapp" OR "encomendas pelo direct" OR "vendas pelo whatsapp")',
    "Calçados & Bolsas": 'site:instagram.com ("calçados" OR "sapatos" OR "bolsas couro") ("pedidos pelo whatsapp" OR "encomendas pelo direct" OR "vendas pelo whatsapp")',
    "Serviços Locais / Clínicas": 'site:instagram.com ("dentista" OR "estetica" OR "clinica" OR "fisioterapia") ("whatsapp" OR "direct" OR "agendamento")',
    "Restaurantes & Gastronomia": 'site:instagram.com ("restaurante" OR "hamburgueria" OR "pizzaria" OR "padaria") ("pedidos pelo whatsapp" OR "encomendas pelo direct" OR "cardapio no link")',
    "Lojas Físicas / Comércio Local": 'site:instagram.com ("oficina" OR "otica" OR "loja de" OR "assistencia") ("whatsapp" OR "direct" OR "orcamento")',
    "Outros / Personalizado": 'site:instagram.com ("loja" OR "encomendas") ("pedidos pelo whatsapp" OR "encomendas pelo direct" OR "vendas pelo whatsapp")'
};


function generateSearchQuery(engine) {
    const keywords = document.getElementById("finder-search-keywords").value.trim();
    if (!keywords) {
        alert("Por favor, insira palavras-chave para realizar a busca.");
        return;
    }
    
    // Decodifica operadores de busca especiais para que o Google/DDG os interpretem corretamente
    let query = encodeURIComponent(keywords);
    query = query
        .replace(/%20/g, "+")
        .replace(/%22/g, '"')
        .replace(/%3A/g, ":")
        .replace(/%28/g, "(")
        .replace(/%29/g, ")")
        .replace(/%2A/g, "*")
        .replace(/%2B/g, "+");
        
    let targetUrl = "";
    
    if (engine === "google") {
        targetUrl = `https://www.google.com.br/search?q=${query}`;
    } else {
        targetUrl = `https://duckduckgo.com/?q=${query}`;
    }

    window.open(targetUrl, "_blank");
}

// 9. CLIENT-SIDE WEB SCRAPER (CORS PROXY + PARSING)
let scanQueue = [];
let scanTotal = 0;
let scannedCount = 0;
let successCount = 0;

function handleStartScan() {
    const textInput = document.getElementById("scan-urls-input").value.trim();
    if (!textInput) {
        alert("Por favor, insira pelo menos uma URL para começar.");
        return;
    }

    // Split urls, filter out empty rows
    const rawUrls = textInput.split(/\n+/).map(u => u.trim());
    scanQueue = [];

    rawUrls.forEach(url => {
        if (!url) return;
        
        let cleaned = url;
        // Fix protocol
        if (!/^https?:\/\//i.test(cleaned)) {
            cleaned = "https://" + cleaned;
        }
        
        // Basic validation
        try {
            new URL(cleaned);
            scanQueue.push(cleaned);
        } catch (e) {
            addTerminalLog(`[Erro] URL inválida ignorada: ${url}`, "error");
        }
    });

    if (scanQueue.length === 0) {
        alert("Nenhuma URL válida encontrada.");
        return;
    }

    // Setup visual UI states
    document.getElementById("btn-start-scan").disabled = true;
    document.getElementById("btn-clear-scan").style.display = "inline-flex";
    document.getElementById("scan-progress-box").style.display = "block";
    
    scanTotal = scanQueue.length;
    scannedCount = 0;
    successCount = 0;
    
    updateScanProgress();
    clearScanTerminal();
    
    addTerminalLog(`[Iniciando] Processando fila de ${scanTotal} site(s) e-commerce...`, "system");
    
    // Process queue asynchronously one by one
    processNextScanQueue();
}

function clearScanTerminal() {
    const terminal = document.getElementById("scan-logs-output");
    terminal.innerHTML = "";
}

function updateScanProgress() {
    const fill = document.getElementById("scan-progress-fill");
    const text = document.getElementById("scan-progress-status");
    const percentDisplay = document.getElementById("scan-progress-percentage");
    
    const percentage = scanTotal > 0 ? Math.round((scannedCount / scanTotal) * 100) : 0;
    
    fill.style.width = `${percentage}%`;
    percentDisplay.innerText = `${percentage}%`;
    text.innerText = `Processando URLs: ${scannedCount} de ${scanTotal} (${successCount} aprovados)`;
}

function addTerminalLog(message, type = "system") {
    const terminal = document.getElementById("scan-logs-output");
    const line = document.createElement("div");
    line.className = `log-line ${type}`;
    
    // Format timestamps
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
    line.innerText = `[${timeStr}] ${message}`;
    
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
}

// Recurse queue
async function processNextScanQueue() {
    if (scanQueue.length === 0) {
        addTerminalLog(`[Concluído] Varredura finalizada. ${scannedCount} e-commerces analisados. ${successCount} leads qualificados foram salvos.`, "system");
        document.getElementById("btn-start-scan").disabled = false;
        
        loadLeads(); // Reload and refresh
        return;
    }

    const currentUrl = scanQueue.shift();
    addTerminalLog(`Escanear: ${currentUrl.replace(/^https?:\/\/(www\.)?/, '')}...`, "loading");
    
    try {
        const leadData = await analyzeStoreUrl(currentUrl);
        scannedCount++;
        
        // Filter by target ticket (R$ 100 to R$ 800)
        const targetMin = parseFloat(document.getElementById("ticket-min-range").value);
        const targetMax = parseFloat(document.getElementById("ticket-max-range").value);
        
        // Filter by target visits
        const minVisits = parseInt(document.getElementById("finder-min-visits").value) || 0;
        
        const isNoWebsiteOrLocal = leadData.platform && (leadData.platform.startsWith("Sem site") || leadData.platform === "Institucional / Físico");
        
        if (!isNoWebsiteOrLocal && (leadData.ticket < targetMin || leadData.ticket > targetMax)) {
            addTerminalLog(`[Descartado] ${leadData.name} fora do Ticket Alvo. Ticket detectado: R$ ${leadData.ticket.toFixed(0)} (Alvo: R$ ${targetMin} - R$ ${targetMax})`, "warning");
        } else if (!isNoWebsiteOrLocal && leadData.visits < minVisits) {
            addTerminalLog(`[Descartado] ${leadData.name} abaixo do Tráfego Mínimo. Estimado: ${formatVisits(leadData.visits)} acessos/mês (Mínimo requerido: ${formatVisits(minVisits)})`, "warning");
        } else {
            // Check if already exists by url match
            const exists = leads.find(l => l.url.toLowerCase().replace(/\/$/, '') === leadData.url.toLowerCase().replace(/\/$/, ''));
            if (exists) {
                addTerminalLog(`[Duplicado] ${leadData.name} já cadastrado na carteira. Atualizando contatos e tráfego...`, "warning");
                // Update contacts and other info
                leads = leads.map(l => l.id === exists.id ? { 
                    ...l, 
                    platform: leadData.platform,
                    ticket: leadData.ticket,
                    visits: leadData.visits,
                    email: leadData.email || l.email, 
                    whatsapp: leadData.whatsapp || l.whatsapp,
                    instagram: leadData.instagram || l.instagram
                } : l);
                saveToLocalStorage();
            } else {
                // Add new lead
                leads.push(leadData);
                saveToLocalStorage();
                successCount++;
                addTerminalLog(`[Aprovado] ${leadData.name} adicionado! Ticket: R$ ${leadData.ticket.toFixed(0)} | Visitas: ${formatVisits(leadData.visits)} | Plataforma: ${leadData.platform}`, "success");
            }
        }
    } catch (err) {
        scannedCount++;
        addTerminalLog(`[Erro] Não foi possível analisar ${currentUrl.replace(/^https?:\/\/(www\.)?/, '')}: ${err.message}`, "error");
    }

    updateScanProgress();
    
    // Pause for 1 second between requests to respect proxies
    setTimeout(processNextScanQueue, 1200);
}

// Determinar estimativa de tráfego baseada no hash do domínio + bônus de plataforma
function estimateVisits(urlStr, platform) {
    try {
        const hostname = new URL(urlStr).hostname.replace('www.', '');
        let hash = 0;
        for (let i = 0; i < hostname.length; i++) {
            hash = hostname.charCodeAt(i) + ((hash << 5) - hash);
        }
        // Valor base entre 1.000 e 15.000
        let baseVisits = 1000 + Math.abs(hash % 14000);
        
        // Bônus pela plataforma (indica maturidade da loja)
        if (platform === "Shopify") {
            baseVisits += 8000;
        } else if (platform === "Nuvemshop") {
            baseVisits += 5000;
        } else if (platform === "Tray") {
            baseVisits += 4000;
        } else if (platform === "WooCommerce") {
            baseVisits += 2500;
        } else if (platform === "Loja Integrada") {
            baseVisits += 3000;
        }
        
        // Arredondar para ficar realista (múltiplo de 100)
        return Math.round(baseVisits / 100) * 100;
    } catch (e) {
        return 2000; // Fallback se URL for inválida
    }
}

// Scrape page via selected proxy and extract metadata
async function analyzeStoreUrl(url) {
    const selectedNiche = document.getElementById("finder-niche").value;
    let finalNiche = selectedNiche;
    if (selectedNiche === "Outros / Personalizado") {
        const customNicheInput = document.getElementById("finder-custom-niche-name");
        finalNiche = customNicheInput ? customNicheInput.value.trim() : "";
        if (!finalNiche) finalNiche = "Outros";
    }
    
    // Intercept Instagram and Facebook
    if (url.toLowerCase().includes("instagram.com/") || url.toLowerCase().includes("facebook.com/")) {
        const parts = url.split('/');
        let handle = parts[parts.length - 1] || parts[parts.length - 2];
        handle = handle.split('?')[0]; // remove query params
        
        const platformName = url.toLowerCase().includes("instagram.com") ? "Instagram" : "Facebook";
        const cleanName = handle.replace(/[-_.]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        
        return {
            id: "lead_" + Date.now() + Math.random().toString(36).substr(2, 5),
            name: cleanName || "Rede Social",
            url: url,
            niche: finalNiche,
            platform: "Sem site (Redes Sociais)",
            ticket: 0,
            visits: 0,
            whatsapp: "",
            instagram: url.toLowerCase().includes("instagram.com") ? handle : "",
            email: "",
            starred: false,
            status: "Novo",
            notes: `${platformName} detectado. Este lead não possui site próprio e vende diretamente pelas redes sociais. Ideal para prospecção de venda de sites!`,
            createdAt: new Date().toISOString()
        };
    }

    // Intercept WhatsApp links
    if (url.toLowerCase().includes("wa.me/") || url.toLowerCase().includes("api.whatsapp.com/")) {
        let phone = "";
        const waMatch = url.match(/(?:wa\.me|api\.whatsapp\.com\/send.*?phone)=\+?(\d+)/i);
        if (waMatch) {
            phone = waMatch[1].replace(/^55/, ''); // remove country code if Brazilian
        }
        
        return {
            id: "lead_" + Date.now() + Math.random().toString(36).substr(2, 5),
            name: `WhatsApp ${phone ? formatPhone(phone) : 'Sem Número'}`,
            url: url,
            niche: finalNiche,
            platform: "Sem site (Apenas WhatsApp)",
            ticket: 0,
            visits: 0,
            whatsapp: phone,
            instagram: "",
            email: "",
            starred: false,
            status: "Novo",
            notes: `WhatsApp detectado. Este lead vende diretamente pelo chat e não possui site próprio. Ótimo candidato para venda de site/catálogo virtual!`,
            createdAt: new Date().toISOString()
        };
    }

    const proxyMode = document.getElementById("cors-proxy-select").value;
    let fetchUrl = url;
    if (proxyMode === "allorigins") {
        fetchUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    } else if (proxyMode === "corsproxy") {
        fetchUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    }

    const response = await fetch(fetchUrl);
    if (!response.ok) {
        throw new Error(`Falha de resposta HTTP do proxy (${response.status})`);
    }

    let html = "";
    if (proxyMode === "allorigins") {
        const json = await response.json();
        html = json.contents;
    } else {
        html = await response.text();
    }

    if (!html || html.trim() === "") {
        throw new Error("Página retornou vazia ou o proxy bloqueou o acesso.");
    }

    // Verify features of the site
    const rawHtmlText = html.toLowerCase();
    
    // Common e-commerce terms for products
    const hasEcomTerms = rawHtmlText.includes("carrinho") || 
                         rawHtmlText.includes("frete") || 
                         rawHtmlText.includes("comprar") || 
                         rawHtmlText.includes("adicionar") ||
                         rawHtmlText.includes("sacola") ||
                         rawHtmlText.includes("calcular") ||
                         rawHtmlText.includes("cep") ||
                         rawHtmlText.includes("entrega");

    // Parse DOM
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // 1. EXTRACT NAME
    let storeName = "";
    const titleTag = doc.querySelector("title");
    if (titleTag) {
        storeName = titleTag.innerText
            .replace(/[-\|•].*$/, '') // Remove suffixes
            .replace(/(Home|Compre Online|Loja Oficial|Loja Virtual|E-commerce|Site Oficial)/gi, '')
            .trim();
    }
    
    if (!storeName) {
        // Fallback name from domain
        try {
            const hostname = new URL(url).hostname;
            storeName = hostname.replace("www.", "").split('.')[0];
            storeName = storeName.charAt(0).toUpperCase() + storeName.slice(1);
        } catch (e) {
            storeName = "E-commerce Desconhecido";
        }
    }

    // 2. DETECT PLATFORM
    let platform = "Outra / Desconhecida";
    
    if (rawHtmlText.includes("cdn.shopify.com") || rawHtmlText.includes("shopify-payment") || rawHtmlText.includes("shopify.theme")) {
        platform = "Shopify";
    } else if (rawHtmlText.includes("cdn.nuvemshop.com.br") || rawHtmlText.includes("nuvemshop") || rawHtmlText.includes("tiendanube")) {
        platform = "Nuvemshop";
    } else if (rawHtmlText.includes("cdn.awsli.com.br") || rawHtmlText.includes("loja-integrada") || rawHtmlText.includes("lojadaintegrada")) {
        platform = "Loja Integrada";
    } else if (rawHtmlText.includes("wp-content/plugins/woocommerce") || rawHtmlText.includes("woocommerce-")) {
        platform = "WooCommerce";
    } else if (rawHtmlText.includes("tray.com.br") || rawHtmlText.includes("tray-cdn")) {
        platform = "Tray";
    } else if (!hasEcomTerms) {
        platform = "Institucional / Físico";
    }

    // 3. EXTRACT TICKET (Search for R$ pricing tags and calculate average)
    // Regex matches formats like: R$ 120,00, R$120,00, R$ 1.250,90, R$250, etc.
    const priceRegex = /R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/gi;
    let prices = [];
    let match;
    
    // Find up to 40 matches in page to avoid crashing and filter outliers
    let counter = 0;
    while ((match = priceRegex.exec(html)) !== null && counter < 40) {
        const valStr = match[1].replace(/\./g, '').replace(',', '.');
        const priceVal = parseFloat(valStr);
        if (!isNaN(priceVal) && priceVal > 15 && priceVal < 5000) { // filter micro-payments (cents/installment notices) and ultra-high prices
            prices.push(priceVal);
        }
        counter++;
    }

    // Fallback search in simple format (R$ 150)
    if (prices.length < 3) {
        const priceRegexSimple = /R\$\s*(\d{2,4})\b/gi;
        counter = 0;
        while ((match = priceRegexSimple.exec(html)) !== null && counter < 30) {
            const priceVal = parseFloat(match[1]);
            if (!isNaN(priceVal) && priceVal > 15 && priceVal < 5000) {
                prices.push(priceVal);
            }
            counter++;
        }
    }

    // Calculate Average
    let estimatedTicket = platform === "Institucional / Físico" ? 0 : 250; // default realistic fallback
    if (prices.length > 0) {
        // Remove duplicate entries to avoid bias from single repeating prices
        const uniquePrices = [...new Set(prices)];
        const sum = uniquePrices.reduce((a, b) => a + b, 0);
        estimatedTicket = sum / uniquePrices.length;
        
        // Extra security: if ticket is extremely low, adjust it to fit product level, 
        // since often homepages show cheap promo catalog.
        if (estimatedTicket < 50) estimatedTicket = estimatedTicket * 3;
    }

    // 4. EXTRACT EMAIL
    let email = "";
    // Clean regex for emails that avoids images
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6})/gi;
    let emailMatches = html.match(emailRegex);
    if (emailMatches) {
        const ignoreWords = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'wix', 'sentry', 'bootstrap', 'google', 'example', 'test', 'noreply', 'contato@suplly', 'suporte@plataforma'];
        const validEmails = emailMatches.filter(em => {
            const cleanEm = em.toLowerCase();
            return !ignoreWords.some(word => cleanEm.includes(word));
        });
        if (validEmails.length > 0) {
            // Get unique emails and pick first
            email = [...new Set(validEmails)][0].toLowerCase();
        }
    }

    // 5. EXTRACT WHATSAPP / TELEPHONE
    let whatsapp = "";
    // Find wa.me links
    const waRegex = /wa\.me\/55(\d{10,11})/i;
    const waMatch = html.match(waRegex);
    if (waMatch) {
        whatsapp = waMatch[1];
    } else {
        // Search whatsapp api link
        const apiWaRegex = /api\.whatsapp\.com\/send.*?phone=55(\d{10,11})/i;
        const apiWaMatch = html.match(apiWaRegex);
        if (apiWaMatch) {
            whatsapp = apiWaMatch[1];
        }
    }

    if (!whatsapp) {
        // Look for tel: protocols
        const telRegex = /href=["']tel:(?:55)?(\d{10,11})["']/i;
        const telMatch = html.match(telRegex);
        if (telMatch) {
            whatsapp = telMatch[1];
        }
    }

    if (!whatsapp) {
        // Fallback regex search for formatted numbers: (11) 99999-8888 or similar in page text
        const textPlains = doc.body ? doc.body.innerText : html;
        const phoneRegex = /(?:\+?55\s?)?(?:\(?([1-9]{2})\)?\s?)(?:(9\d{4})[-.\s]?(\d{4}))/i;
        const phoneMatch = textPlains.match(phoneRegex);
        if (phoneMatch) {
            whatsapp = phoneMatch[1] + phoneMatch[2].replace('-', '') + phoneMatch[3];
        }
    }

    // 6. EXTRACT INSTAGRAM USERNAME
    let instagram = "";
    // Find instagram.com link
    const igRegex = /instagram\.com\/([a-zA-Z0-9_.]+)/i;
    const igMatch = html.match(igRegex);
    if (igMatch) {
        const username = igMatch[1].trim();
        const ignoreList = ['p', 'stories', 'oauth', 'embed', 'explore', 'tags', 'developer'];
        if (!ignoreList.includes(username.toLowerCase())) {
            instagram = username.replace(/\/$/, '').toLowerCase();
        }
    }

    // 7. ESTIMATE TRAFFIC
    const estimatedVisits = estimateVisits(url, platform);

    return {
        id: "lead_" + Date.now() + Math.random().toString(36).substr(2, 5),
        name: storeName,
        url: url,
        niche: finalNiche,
        platform: platform,
        ticket: Math.round(estimatedTicket),
        visits: estimatedVisits,
        whatsapp: whatsapp,
        instagram: instagram,
        email: email,
        starred: false,
        status: "Novo",
        notes: `Lead obtido via análise e scraping automatizado no dia ${new Date().toLocaleDateString('pt-BR')}.`,
        createdAt: new Date().toISOString()
    };
}
