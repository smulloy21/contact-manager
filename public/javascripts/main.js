class ContactsApp {
  constructor() {
    this.allContacts = [];
    this.activeTag = null;
    this.editingId = null;

    this.contactsDiv = document.getElementById('contacts');
    this.contactForm = document.getElementById('contact-form');
    this.searchBar = document.getElementById('search');
  }

  init() {
    this.loadContacts();

    document.getElementById('add-contact-button')
      .addEventListener('click', () => this.openForm());
    document.getElementById('cancel-add-contact')
      .addEventListener('click', () => this.closeForm());
    this.contactForm
      .addEventListener('submit', (e) => this.handleContactSubmit(e));
    this.contactsDiv
      .addEventListener('click', (e) => this.handleContactsClick(e));
    this.searchBar
      .addEventListener('input', () => this.applyFilters());
    this.contactForm.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', () => {
        const error = input.closest('.field-group')?.querySelector('.field-error');
        if (error) error.classList.add('hidden');
        input.classList.remove('input--error');
      });
    });
  }

  async apiFetch(url, options = {}) {
    let response = await fetch(url, options);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response;
  }

  async loadContacts() {
    try {
      let response = await this.apiFetch('/api/contacts');
      this.allContacts = await response.json();
      this.applyFilters();
    } catch (err) {
      this.contactsDiv.innerHTML = `
        <div class="error-state">
          <p>Couldn't load contacts. Check your connection and <a href="">refresh</a>.</p>
        </div>`;
      console.error(err);
    }
  }

  async saveNewContact(payload) {
    try {
      let response = await this.apiFetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: payload,
      });
      let contact = await response.json();
      this.allContacts.push(contact);
    } catch (err) {
      this.showToast("Contact wasn't saved. Please try again.");
      console.error(err);
    }
  }

  async updateContact(payload) {
    try {
      let response = await this.apiFetch(`/api/contacts/${this.editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: payload,
      });
      let updated = await response.json();
      this.allContacts = this.allContacts.map(contact => {
        return contact.id === updated.id ? updated : contact;
      });
      this.editingId = null;
    } catch (err) {
      this.showToast("Changes couldn't be saved. Please try again.");
      console.error(err);
    }
  }

  async handleDelete(contactId) {
    try {
      await this.apiFetch(`/api/contacts/${contactId}`, { method: 'DELETE' });
      this.allContacts = this.allContacts.filter(c => c.id !== contactId);
      this.applyFilters();
    } catch (err) {
      this.showToast('Could not delete contact. Please try again.');
      console.error(err);
    }
  }

  async handleEdit(contactId) {
    try {
      let response = await this.apiFetch(`/api/contacts/${contactId}`);
      let contact = await response.json();
      this.editingId = contactId;
      this.contactForm.querySelector('[name="full_name"]').value = contact.full_name;
      this.contactForm.querySelector('[name="email"]').value = contact.email;
      this.contactForm.querySelector('[name="phone_number"]').value = contact.phone_number;
      this.contactForm.querySelector('[name="tags"]').value = contact.tags || '';
      this.openForm();
    } catch (err) {
      this.showToast('Could not load contact. Please try again.');
      console.error(err);
    }
  }

  async handleContactSubmit(event) {
    event.preventDefault();
    if (!this.validate()) return;
    let formData = new FormData(this.contactForm);
    let payload = JSON.stringify(Object.fromEntries(formData));
    if (this.editingId !== null) {
      await this.updateContact(payload);
    } else {
      await this.saveNewContact(payload);
    }
    this.closeForm();
    this.applyFilters();
  }

  openForm() {
    this.contactForm.classList.remove('hidden');
    this.contactForm.scrollIntoView({ behavior: 'smooth' });
  }

  closeForm() {
    this.contactForm.reset();
    this.editingId = null;
    this.contactForm.classList.add('hidden');
  }

  getValidationRules() {
    return [
      {
        input: this.contactForm.querySelector('[name="full_name"]'),
        messages: { valueMissing: 'Please enter a full name.' }
      }, {
        input: this.contactForm.querySelector('[name="email"]'),
        messages: {
          valueMissing: 'Please enter an email address.',
          typeMismatch: 'Please enter a valid email address.',
        }
      }, {
        input: this.contactForm.querySelector('[name="phone_number"]'),
        messages: {
          valueMissing: 'Please enter a phone number.',
          patternMismatch: 'Please enter a valid phone number.',
        }
      },
    ];
  }

  validateField({ input, messages }) {
    const error = input.closest('.field-group').querySelector('.field-error');
    const validity = input.validity;
    const failedRule = Object.keys(messages).find(key => validity[key]);

    if (!validity.valid) {
      error.textContent = messages[failedRule] ?? 'This field is invalid.';
      error.classList.remove('hidden');
      input.classList.add('input--error');
      return false;
    }

    error.textContent = '';
    error.classList.add('hidden');
    input.classList.remove('input--error');
    return true;
  }

  validate() {
    return this.getValidationRules()
      .map(rule => this.validateField(rule))
      .every(Boolean);
  }

  applyFilters() {
    let searchTerm = this.searchBar.value.toLowerCase().trim();
    let filtered = this.allContacts.filter(contact => {
      let matchesSearch = !searchTerm ||
        contact.full_name.toLowerCase().includes(searchTerm) ||
        contact.email.toLowerCase().includes(searchTerm) ||
        (contact.tags && contact.tags.toLowerCase().includes(searchTerm));
      let matchesTag = !this.activeTag ||
        (contact.tags && contact.tags.split(',').map(t => t.trim()).includes(this.activeTag));
      return matchesSearch && matchesTag;
    });
    this.renderContacts(filtered);
  }

  renderContacts(contacts) {
    this.contactsDiv.innerHTML = '';
    contacts.forEach(contact => this.createContact(contact));
  }

  createContact(contact) {
    let card = document.createElement('div');
    card.classList.add('card', 'w-25');
    card.dataset.id = contact.id;
    card.innerHTML = this.contactTemplate(contact);
    this.contactsDiv.append(card);
  }

  contactTemplate(contact) {
    return `
      <div class="card-body">
        <h4 class="card-title">${contact.full_name}</h4>
        <h6 class="card-subtitle mb-2 text-muted">${contact.email}</h6>
        <p class="card-text">${contact.phone_number}</p>
        ${this.tagLinks(contact.tags)}
        <br>
        ${this.editAndDeleteButtons()}
      </div>`;
  }

  tagLinks(tags) {
    if (!tags) return '';
    return tags.split(',')
      .map(tag => tag.trim())
      .map(tag => `<span class="tag ${tag === this.activeTag ? 'active' : ''}" data-tag="${tag}">${tag}</span>`)
      .join(' • ');
  }

  editAndDeleteButtons() {
    return `
      <button type="button" class="my-3 btn btn-primary" data-action="edit" aria-label="Edit contact">
        <svg xmlns="http://w3.org" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      </button>
      <button type="button" class="my-3 btn btn-danger" data-action="delete" aria-label="Delete contact">
        <svg xmlns="http://w3.org" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      </button>`;
  }

  handleContactsClick(event) {
    const editBtn = event.target.closest('[data-action="edit"]');
    const deleteBtn = event.target.closest('[data-action="delete"]');
    const tagLink = event.target.closest('[data-tag]');

    if (editBtn) this.handleEdit(Number(editBtn.closest('.card').dataset.id));
    if (deleteBtn) this.handleDelete(Number(deleteBtn.closest('.card').dataset.id));
    if (tagLink) {
      let clicked = tagLink.dataset.tag;
      this.activeTag = this.activeTag === clicked ? null : clicked;
      this.applyFilters();
    }
  }

  showToast(message, type = 'error') {
    let container = document.getElementById('toast-container');
    let toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    container.append(toast);
    setTimeout(() => toast.remove(), 4000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new ContactsApp();
  app.init();
});
