import Contact from '@/models/Contact'
import * as API from '@/util/Api'

export default class ContactCache {
  private contactMap = new Map<String, Contact>()

  public async get(id: string): Promise<Contact> {
    if (this.contactMap.has(id)) {
      const contact = this.contactMap.get(id)
      if (contact) {
        return contact
      }
    }

    const contact = await API.getContact(id)
    this.contactMap.set(id, contact)

    return contact
  }
}
