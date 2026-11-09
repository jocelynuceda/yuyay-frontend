import isologo from '../../assets/brand/isologo.svg'
import isologoDark from '../../assets/brand/isologo-dark.svg'

/** Logo de las pantallas de acceso. El nombre va como texto para los lectores de pantalla y el título de la pestaña. */
export function AuthBrand() {
  return (
    <h1 className="mb-8 flex justify-center">
      <img src={isologo} alt="" className="h-20 w-auto sm:h-24 dark:hidden" />
      <img src={isologoDark} alt="" className="hidden h-20 w-auto sm:h-24 dark:inline" />
      <span className="sr-only">Yuyay</span>
    </h1>
  )
}
