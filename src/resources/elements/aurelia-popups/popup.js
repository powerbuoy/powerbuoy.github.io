import {inject, bindable, bindingMode, inlineView} from 'aurelia-framework';
import {EventAggregator} from 'aurelia-event-aggregator';

@inlineView('<template><div class="popup-box"><a click.delegate="close()" class="close">&times;</a><h2 if.bind="title">${title}</h2><slot></slot></div><nav if.bind="buttons"><a repeat.for="button of buttons" class="button ${button.cssClasses}" click.delegate="buttonAction(button)">${button.title}</a></nav></div></template>')
@inject(Element, EventAggregator)
export class PopupCustomElement {
	@bindable title = null;
	@bindable name = 'dialog';
	@bindable size = false;
	@bindable({defaultBindingMode: bindingMode.twoWay}) isOpen = false;
	@bindable buttons = [
		{
			title: 'Ok',
			keyCode: 13,
			action: dialog => {
				this.close();
			}
		}
	];

	constructor (el, ea) {
		this.el = el;
		this.ea = ea;

		// Close popup on outside click
		this.closeOnOutsideClick = e => {
			if (e.target === this.el) {
				this.close();
			}
		};

		// Listen for some keyboard keys
		this.handleKeyDown = e => {
			// ESC = Close
			if (e.keyCode == 27) {
				this.close();
			}
			// Check for potential buttons asking to hook into keyboard
			if (this.buttons) {
				let button = this.buttons.find(i => {
					return i.keyCode == e.keyCode;
				});

				if (button) {
					this.buttonAction(button);
				}
			}
		};
	}

	attached () {
		// Add ID and size class
		this.el.id = this.name;

		if (this.size) {
			this.el.classList.add('size-' + this.size);
		}

		// Listen for external requests to open popups
		this.popupOpenSubscription = this.ea.subscribe('popup:open', popupName => {
			if (this.name === popupName) {
				this.open();
			}
		});

		// --"--
		this.popupCloseSubscription = this.ea.subscribe('popup:close', popupName => {
			if (this.name === popupName) {
				this.close();
			}
		});

		// Close popup on route change
		this.navigationSubscription = this.ea.subscribe('router:navigation:processing', event => {
			this.close();
		});

		// Close when clicking outside popup and listen for keyboard
		this.el.addEventListener('click', this.closeOnOutsideClick);
		window.addEventListener('keydown', this.handleKeyDown);
	}

	detached () {
		this.popupOpenSubscription.dispose();
		this.popupCloseSubscription.dispose();
		this.navigationSubscription.dispose();
		this.el.removeEventListener('click', this.closeOnOutsideClick);
		window.removeEventListener('keydown', this.handleKeyDown);
	}

	close () {
		this.isOpen = false;
	}

	open () {
		this.isOpen = true;
	}

	toggle () {
		this.isOpen = !this.isOpen;
	}

	isOpenChanged () {
		if (this.isOpen) {
			this.el.classList.add('open');
		}
		else {
			this.el.classList.remove('open');
		}
	}

	buttonAction (button) {
		if (typeof button.action === 'function') {
			button.action(this);
		}
		else if (button.action === 'close') {
			this.close();
		}
	}
}
