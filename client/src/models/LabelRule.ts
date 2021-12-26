export class LabelRule {
  text: string
  label_id: number

  static fromJson(labelRuleJson: any) {
    return new LabelRule(labelRuleJson.text, labelRuleJson.label_id)
  }

  constructor(text: string, label_id: number) {
    this.text = text
    this.label_id = label_id
  }
}
