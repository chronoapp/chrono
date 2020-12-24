export default {
  option: (provided, state) => ({
    ...provided,
    fontSize: '0.75rem',
    height: '30px',
  }),
  singleValue: (provided, state) => {
    return { ...provided, marginLeft: 'auto', marginRight: 'auto' }
  },
  container: (provided, state) => {
    return {
      ...provided,
      fontSize: '0.8rem',
      zIndex: 5,
    }
  },
  control: (provided, state) => {
    return {
      ...provided,
      borderStyle: 'none none solid none',
      boxShadow: null,
      borderColor: 'hsl(0, 0%, 86%)', // $grey-lighter
      borderRadius: 0,
      borderWidth: '3px',
    }
  },
}
